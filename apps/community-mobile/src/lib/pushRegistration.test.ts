import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  PUSH_REGISTRATION_KEY,
  PUSH_UNREGISTER_TIMEOUT_MS,
  SESSION_REVOKE_TIMEOUT_MS,
  forgetPushRegistration,
  readPushRegistration,
  rememberPushRegistration,
  signOutUnregisteringPush,
  unregisterLapsedSessionPush,
  type PersistedPushRegistration,
  type PushRegistrationStore,
  type PushUnregisterDeps,
  type SignOutUnregisteringPushDeps,
} from "./pushRegistration.ts"

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

function memoryStore(seed?: Record<string, string>): PushRegistrationStore {
  const map = new Map<string, string>(Object.entries(seed ?? {}))
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
    },
    delete: (key) => {
      map.delete(key)
    },
  }
}

function signOutProbe(overrides: Partial<SignOutUnregisteringPushDeps> = {}) {
  const store = overrides.store ?? memoryStore()
  const order: string[] = []
  const sent: { registration: PersistedPushRegistration; bearer: string }[] = []
  const revoked: string[] = []
  const deps: SignOutUnregisteringPushDeps = {
    store,
    readBearer: async () => "current-bearer",
    completeSignOut: async () => {
      order.push("signed-out")
    },
    unregister: async (registration, bearer) => {
      order.push("unregistered")
      sent.push({ registration, bearer })
    },
    revokeSession: async (bearer) => {
      order.push("revoked")
      revoked.push(bearer)
    },
    ...overrides,
  }
  return { deps, store, order, sent, revoked }
}

test("a registration round-trips through the store", () => {
  const store = memoryStore()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })
  assert.deepEqual(readPushRegistration(store), {
    platform: "ios",
    token: "ExponentPushToken[abc]",
  })
  forgetPushRegistration(store)
  assert.equal(readPushRegistration(store), null)
})

test("a missing, malformed or half-written value never yields a registration", () => {
  assert.equal(readPushRegistration(memoryStore()), null)
  assert.equal(readPushRegistration(memoryStore({ [PUSH_REGISTRATION_KEY]: "not json" })), null)
  assert.equal(
    readPushRegistration(memoryStore({ [PUSH_REGISTRATION_KEY]: JSON.stringify({ token: "t" }) })),
    null,
  )
  assert.equal(
    readPushRegistration(
      memoryStore({ [PUSH_REGISTRATION_KEY]: JSON.stringify({ platform: "desktop", token: "t" }) }),
    ),
    null,
  )
  assert.equal(
    readPushRegistration(
      memoryStore({ [PUSH_REGISTRATION_KEY]: JSON.stringify({ platform: "ios", token: "" }) }),
    ),
    null,
  )
})

test("sign-out unregisters the EXACT values registration persisted, with the captured bearer", async () => {
  const { deps, store, sent, revoked } = signOutProbe()
  rememberPushRegistration(store, { platform: "android", token: "ExponentPushToken[xyz]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(sent, [
    {
      registration: { platform: "android", token: "ExponentPushToken[xyz]" },
      bearer: "current-bearer",
    },
  ])
  assert.deepEqual(revoked, ["current-bearer"])
  assert.equal(readPushRegistration(store), null)
})

test("the push token is released BEFORE the session is revoked, and both before local teardown", async () => {
  const { deps, store, order } = signOutProbe()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["unregistered", "revoked", "signed-out"])
})

test("the unregister and the revoke carry the SAME bearer, captured once before it is cleared", async () => {
  let reads = 0
  const { deps, store, sent, revoked } = signOutProbe({
    readBearer: async () => {
      reads += 1
      return "live-bearer"
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(reads, 1)
  assert.equal(sent[0]?.bearer, "live-bearer")
  assert.deepEqual(revoked, ["live-bearer"])
})

test("an unregister that NEVER SETTLES still leaves sign-out complete, and never stops the revoke", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    const { deps, store, order } = signOutProbe({ unregister: () => new Promise<never>(() => {}) })
    rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

    const signingOut = signOutUnregisteringPush(deps)
    await tick()
    assert.deepEqual(order, [])

    mock.timers.tick(PUSH_UNREGISTER_TIMEOUT_MS)
    await signingOut

    assert.deepEqual(order, ["revoked", "signed-out"])
    assert.equal(readPushRegistration(store), null)
  } finally {
    mock.timers.reset()
  }
})

test("a revoke that NEVER SETTLES cannot hold sign-out open either", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    let signal: AbortSignal | null = null
    const { deps, store, order } = signOutProbe({
      revokeSession: (_bearer, received) => {
        signal = received
        return new Promise<never>(() => {})
      },
    })
    rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

    const signingOut = signOutUnregisteringPush(deps)
    await tick()
    assert.deepEqual(order, ["unregistered"])
    assert.ok(signal)
    assert.equal((signal as AbortSignal).aborted, false)

    mock.timers.tick(SESSION_REVOKE_TIMEOUT_MS)
    await signingOut

    assert.equal((signal as AbortSignal).aborted, true)
    assert.deepEqual(order, ["unregistered", "signed-out"])
  } finally {
    mock.timers.reset()
  }
})

test("a REJECTED revoke still completes sign-out and never escapes", async () => {
  let attempts = 0
  const { deps, store, order } = signOutProbe({
    revokeSession: async () => {
      attempts += 1
      throw new Error("503 service unavailable")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(attempts, 1)
  assert.deepEqual(order, ["unregistered", "signed-out"])
})

test("a revoke that THROWS synchronously never escapes sign-out", async () => {
  const { deps, store, order } = signOutProbe({
    revokeSession: () => {
      throw new Error("client blew up")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["unregistered", "signed-out"])
})

test("a hung unregister is ABORTED once the bound lapses, not merely abandoned", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    let signal: AbortSignal | null = null
    const { deps, store } = signOutProbe({
      unregister: (_registration, _bearer, received) => {
        signal = received
        return new Promise<never>(() => {})
      },
    })
    rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

    const signingOut = signOutUnregisteringPush(deps)
    await tick()

    assert.ok(signal)
    assert.equal((signal as AbortSignal).aborted, false)
    mock.timers.tick(PUSH_UNREGISTER_TIMEOUT_MS)
    await signingOut
    assert.equal((signal as AbortSignal).aborted, true)
  } finally {
    mock.timers.reset()
  }
})

test("a REJECTED unregister still completes sign-out and never escapes", async () => {
  let attempts = 0
  const { deps, store, order } = signOutProbe({
    unregister: async () => {
      attempts += 1
      throw new Error("network down")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(attempts, 1)
  assert.deepEqual(order, ["revoked", "signed-out"])
  assert.equal(readPushRegistration(store), null)
})

test("an unregister that THROWS synchronously never escapes sign-out", async () => {
  const { deps, store, order } = signOutProbe({
    unregister: () => {
      throw new Error("client blew up")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["revoked", "signed-out"])
})

test("an UNREADABLE keychain signs out without attempting an unauthenticated call of either kind", async () => {
  let attempts = 0
  let revokes = 0
  const { deps, store, order } = signOutProbe({
    readBearer: async () => null,
    unregister: async () => {
      attempts += 1
    },
    revokeSession: async () => {
      revokes += 1
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(attempts, 0)
  assert.equal(revokes, 0)
  assert.deepEqual(order, ["signed-out"])
  assert.equal(readPushRegistration(store), null)
})

test("a THROWING keychain read cannot block sign-out", async () => {
  const { deps, store, order } = signOutProbe({
    readBearer: async () => {
      throw new Error("keychain gone")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["signed-out"])
})

test("no persisted registration still revokes the session: the bearer is read for the logout", async () => {
  let reads = 0
  let attempts = 0
  const { deps, order, revoked } = signOutProbe({
    readBearer: async () => {
      reads += 1
      return "current-bearer"
    },
    unregister: async () => {
      attempts += 1
    },
  })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(reads, 1)
  assert.equal(attempts, 0)
  assert.deepEqual(revoked, ["current-bearer"])
  assert.deepEqual(order, ["revoked", "signed-out"])
})

function lapsedProbe(overrides: Partial<PushUnregisterDeps> = {}) {
  const store = overrides.store ?? memoryStore()
  const sent: { registration: PersistedPushRegistration; bearer: string }[] = []
  const deps: PushUnregisterDeps = {
    store,
    readBearer: async () => "stale-bearer",
    unregister: async (registration, bearer) => {
      sent.push({ registration, bearer })
    },
    ...overrides,
  }
  return { deps, store, sent }
}

test("an EXPIRED session still tells the server to release the push token", async () => {
  const { deps, store, sent } = lapsedProbe()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  unregisterLapsedSessionPush(deps)
  await tick()

  assert.deepEqual(sent, [
    {
      registration: { platform: "ios", token: "ExponentPushToken[abc]" },
      bearer: "stale-bearer",
    },
  ])
  assert.equal(readPushRegistration(store), null)
})

test("the local registration is forgotten SYNCHRONOUSLY, before the call is even issued", () => {
  const { deps, store, sent } = lapsedProbe()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  unregisterLapsedSessionPush(deps)

  assert.equal(readPushRegistration(store), null)
  assert.deepEqual(sent, [])
})

test("the bearer read is issued SYNCHRONOUSLY, ahead of the token clear that follows teardown", () => {
  let reads = 0
  const { deps, store } = lapsedProbe({
    readBearer: async () => {
      reads += 1
      return "stale-bearer"
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  unregisterLapsedSessionPush(deps)

  assert.equal(reads, 1)
})

test("teardown can AWAIT the bearer capture, so a slow keychain still beats the token clear", async () => {
  const order: string[] = []
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const { deps, store, sent } = lapsedProbe({
    readBearer: async () => {
      await held
      order.push("bearer-read")
      return "still-valid-bearer"
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  const captured = unregisterLapsedSessionPush(deps)
  const clearToken = async () => {
    await captured
    order.push("token-cleared")
  }
  const clearing = clearToken()
  release()
  await clearing
  await tick()

  assert.deepEqual(order, ["bearer-read", "token-cleared"])
  assert.deepEqual(sent, [
    {
      registration: { platform: "ios", token: "ExponentPushToken[abc]" },
      bearer: "still-valid-bearer",
    },
  ])
})

test("the awaited handle stays fire-and-forget: it never rejects and never waits on the network", async () => {
  const thrower = lapsedProbe({
    readBearer: async () => {
      throw new Error("keychain gone")
    },
  })
  rememberPushRegistration(thrower.store, { platform: "ios", token: "ExponentPushToken[abc]" })
  await assert.doesNotReject(() => unregisterLapsedSessionPush(thrower.deps))

  let settled = false
  const hanging = lapsedProbe({
    unregister: () =>
      new Promise(() => {
        settled = true
      }),
  })
  rememberPushRegistration(hanging.store, { platform: "ios", token: "ExponentPushToken[abc]" })
  await unregisterLapsedSessionPush(hanging.deps)
  assert.equal(settled, true)

  const none = lapsedProbe()
  await assert.doesNotReject(() => unregisterLapsedSessionPush(none.deps))
})

test("a REJECTED unregister on an expired session never escapes teardown", async () => {
  let attempts = 0
  const { deps, store } = lapsedProbe({
    unregister: async () => {
      attempts += 1
      throw new Error("401 unauthorized")
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  unregisterLapsedSessionPush(deps)
  await tick()

  assert.equal(attempts, 1)
  assert.equal(readPushRegistration(store), null)
})

test("a THROWING or EMPTY keychain read leaves teardown complete and sends nothing", async () => {
  const thrower = lapsedProbe({
    readBearer: () => {
      throw new Error("keychain gone")
    },
  })
  rememberPushRegistration(thrower.store, { platform: "ios", token: "ExponentPushToken[abc]" })
  unregisterLapsedSessionPush(thrower.deps)

  const empty = lapsedProbe({ readBearer: async () => null })
  rememberPushRegistration(empty.store, { platform: "ios", token: "ExponentPushToken[abc]" })
  unregisterLapsedSessionPush(empty.deps)

  await tick()

  assert.deepEqual(thrower.sent, [])
  assert.deepEqual(empty.sent, [])
  assert.equal(readPushRegistration(thrower.store), null)
  assert.equal(readPushRegistration(empty.store), null)
})

test("no persisted registration means an expired session reads no bearer and calls nothing", async () => {
  let reads = 0
  const { deps, sent } = lapsedProbe({
    readBearer: async () => {
      reads += 1
      return "stale-bearer"
    },
  })

  unregisterLapsedSessionPush(deps)
  await tick()

  assert.equal(reads, 0)
  assert.deepEqual(sent, [])
})

test("sign-out's own teardown cannot double-unregister, the registration is already gone", async () => {
  const { deps, store, sent } = lapsedProbe()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  unregisterLapsedSessionPush(deps)
  unregisterLapsedSessionPush(deps)
  await tick()

  assert.equal(sent.length, 1)
})

test("an UNREADABLE store never blocks sign-out", async () => {
  const broken: PushRegistrationStore = {
    getString: () => {
      throw new Error("mmkv gone")
    },
    set: () => {
      throw new Error("mmkv gone")
    },
    delete: () => {
      throw new Error("mmkv gone")
    },
  }
  const { deps, order } = signOutProbe({ store: broken })
  rememberPushRegistration(broken, { platform: "ios", token: "t" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["revoked", "signed-out"])
})

test("the store revokes on the EXPLICIT sign-out only, never on the lapsed or foreign paths", () => {
  const source = readFileSync(new URL("../store/authStore.ts", import.meta.url), "utf8")
  const signOut = source.slice(source.indexOf("  signOut: async () => {"))
  const body = signOut.slice(0, signOut.indexOf("\n  },"))
  assert.match(body, /revokeSession: \(bearer, signal\) =>/)
  assert.match(body, /api\.logout\(/)
  assert.equal(source.match(/revokeSession:/g)?.length, 1)
  assert.equal(source.match(/api\.logout\(/g)?.length, 1)

  const lapsed = source.slice(source.indexOf("  markUnauthed: () => {"))
  assert.doesNotMatch(lapsed.slice(0, lapsed.indexOf("\n  },")), /revokeSession|api\.logout/)
})
