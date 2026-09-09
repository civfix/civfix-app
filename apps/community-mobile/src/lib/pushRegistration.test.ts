import { test, mock } from "node:test"
import assert from "node:assert/strict"
import {
  PUSH_REGISTRATION_KEY,
  PUSH_UNREGISTER_TIMEOUT_MS,
  forgetPushRegistration,
  readPushRegistration,
  rememberPushRegistration,
  signOutUnregisteringPush,
  type PersistedPushRegistration,
  type PushRegistrationStore,
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
    ...overrides,
  }
  return { deps, store, order, sent }
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
  const { deps, store, sent } = signOutProbe()
  rememberPushRegistration(store, { platform: "android", token: "ExponentPushToken[xyz]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(sent, [
    {
      registration: { platform: "android", token: "ExponentPushToken[xyz]" },
      bearer: "current-bearer",
    },
  ])
  assert.equal(readPushRegistration(store), null)
})

test("the session is torn down BEFORE the unregister is ever attempted", async () => {
  const { deps, store, order } = signOutProbe()
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["signed-out", "unregistered"])
})

test("an unregister that NEVER SETTLES still leaves sign-out complete", async () => {
  const { deps, store, order } = signOutProbe({ unregister: () => new Promise<never>(() => {}) })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.deepEqual(order, ["signed-out"])
  assert.equal(readPushRegistration(store), null)
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

    await signOutUnregisteringPush(deps)
    await tick()

    assert.ok(signal)
    assert.equal((signal as AbortSignal).aborted, false)
    mock.timers.tick(PUSH_UNREGISTER_TIMEOUT_MS)
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
  assert.deepEqual(order, ["signed-out"])
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

  assert.deepEqual(order, ["signed-out"])
})

test("an UNREADABLE keychain signs out without attempting an unauthenticated unregister", async () => {
  let attempts = 0
  const { deps, store, order } = signOutProbe({
    readBearer: async () => null,
    unregister: async () => {
      attempts += 1
    },
  })
  rememberPushRegistration(store, { platform: "ios", token: "ExponentPushToken[abc]" })

  await signOutUnregisteringPush(deps)
  await tick()

  assert.equal(attempts, 0)
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

test("no persisted registration means no bearer read and no unregister call at all", async () => {
  let reads = 0
  let attempts = 0
  const { deps, order } = signOutProbe({
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

  assert.equal(reads, 0)
  assert.equal(attempts, 0)
  assert.deepEqual(order, ["signed-out"])
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

  assert.deepEqual(order, ["signed-out"])
})
