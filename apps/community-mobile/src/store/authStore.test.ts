import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { AppError, ErrorCode } from "@civfix/shared"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"
import type * as AuthModule from "./authStore.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({
  "@civfix/ui": STUBS,
  "@civfix/ui/data": STUBS,
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkvPersister": STUBS,
})

const { calls, control, memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { CACHED_USER_KEY, LAST_IDENTITY_KEY } = await import("../lib/mmkvKeys.ts")
const { PUSH_REGISTRATION_KEY } = await import("../lib/pushRegistration.ts")

let instance = 0

async function freshStore(): Promise<typeof AuthModule.useAuthStore> {
  instance += 1
  const module = (await import(`./authStore.ts?instance=${instance}`)) as typeof AuthModule
  return module.useAuthStore
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

const USER = { id: "u-1", name: "Ada" }
const OTHER = { id: "u-2", name: "Grace" }

const TEARDOWN = [
  "clearPersistedCache",
  "chatSocket.disconnect",
  "queryClient.clear",
  "discardViewerDrafts",
  "resumeCachePersistence",
]

const VIEWER_REFETCH = [
  "myReportsRoot",
  "threads",
  "notificationsRoot",
  "profileRoot",
  "postsRoot",
  "postRoot",
  "reportRoot",
  "cleanupRoot",
  "chatRoot",
  "volunteer",
].map((key) => `queryClient.invalidate:${JSON.stringify([key])}`)

function signedInSession(user: object) {
  return async () => ({ authenticated: true, user, guestSmsEnabled: true })
}

function snapshot(store: Awaited<ReturnType<typeof freshStore>>) {
  const { status, user, sessionPresent, networkOutcome, guestSmsEnabled } = store.getState()
  return { status, user, sessionPresent, networkOutcome, guestSmsEnabled }
}

beforeEach(() => {
  resetStubs()
})

test("an unreadable token signs out locally without tearing the identity down, then refreshes guest capabilities", async () => {
  control.token = { ok: false }
  const store = await freshStore()
  await store.getState().hydrate()
  await settle()
  assert.deepEqual(calls, ["readToken", "api.session"])
  assert.deepEqual(snapshot(store), {
    status: "unauthed",
    user: null,
    sessionPresent: false,
    networkOutcome: "ok",
    guestSmsEnabled: false,
  })
})

test("no stored token tears the identity down and refreshes guest capabilities", async () => {
  memory.set(CACHED_USER_KEY, JSON.stringify(USER))
  const store = await freshStore()
  await store.getState().hydrate()
  await settle()
  assert.deepEqual(calls, ["readToken", ...TEARDOWN, "api.session"])
  assert.equal(memory.has(CACHED_USER_KEY), false)
  assert.deepEqual(snapshot(store), {
    status: "unauthed",
    user: null,
    sessionPresent: false,
    networkOutcome: "ok",
    guestSmsEnabled: false,
  })
})

test("a live session adopts the user and remembers it as the device identity", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session"])
  assert.deepEqual(snapshot(store), {
    status: "authed",
    user: USER,
    sessionPresent: true,
    networkOutcome: "ok",
    guestSmsEnabled: true,
  })
  assert.equal(memory.get(CACHED_USER_KEY), JSON.stringify(USER))
  assert.equal(memory.get(LAST_IDENTITY_KEY), USER.id)
})

test("a cached user stays signed in through a network error or a deadline", async () => {
  const failures: [unknown, string][] = [
    [new TypeError("Network request failed"), "error"],
    [Object.assign(new Error("late"), { name: "RequestDeadlineError" }), "timeout"],
    [new AppError(ErrorCode.INTERNAL, "boom"), "ok"],
  ]
  for (const [failure, outcome] of failures) {
    resetStubs()
    control.token = { ok: true, token: "tok" }
    memory.set(CACHED_USER_KEY, JSON.stringify(USER))
    control.session = async () => {
      throw failure
    }
    const store = await freshStore()
    await store.getState().hydrate()
    assert.deepEqual(calls, ["readToken", "api.session"], outcome)
    assert.deepEqual(snapshot(store), {
      status: "authed",
      user: USER,
      sessionPresent: true,
      networkOutcome: outcome,
      guestSmsEnabled: undefined,
    })
  }
})

test("without a cached user a network error signs out locally but keeps the token and the session-present flag", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = async () => {
    throw new TypeError("Network request failed")
  }
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session"])
  assert.deepEqual(control.token, { ok: true, token: "tok" })
  assert.deepEqual(snapshot(store), {
    status: "unauthed",
    user: null,
    sessionPresent: true,
    networkOutcome: "error",
    guestSmsEnabled: undefined,
  })
})

test("a 401 tears the identity down and clears the token", async () => {
  control.token = { ok: true, token: "tok" }
  memory.set(CACHED_USER_KEY, JSON.stringify(USER))
  control.session = async () => {
    throw new AppError(ErrorCode.UNAUTHORIZED, "expired")
  }
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session", ...TEARDOWN, "clearToken"])
  assert.deepEqual(snapshot(store), {
    status: "unauthed",
    user: null,
    sessionPresent: false,
    networkOutcome: "ok",
    guestSmsEnabled: undefined,
  })
})

test("a token the server no longer honours tears the identity down and clears the token", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = async () => ({ authenticated: false, user: null, guestSmsEnabled: true })
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session", ...TEARDOWN, "clearToken"])
  assert.equal(store.getState().status, "unauthed")
  assert.equal(store.getState().guestSmsEnabled, true)
})

test("a different account than the one last on the device purges the caches before it is adopted", async () => {
  control.token = { ok: true, token: "tok" }
  memory.set(LAST_IDENTITY_KEY, OTHER.id)
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session", "purgeQueryCache", "clearSecureBlobs"])
  assert.equal(memory.get(LAST_IDENTITY_KEY), USER.id)
})

test("the cached user stands in for the last identity when none was remembered", async () => {
  control.token = { ok: true, token: "tok" }
  memory.set(CACHED_USER_KEY, JSON.stringify(OTHER))
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session", "purgeQueryCache", "clearSecureBlobs"])
})

test("the same account coming back keeps its caches", async () => {
  control.token = { ok: true, token: "tok" }
  memory.set(LAST_IDENTITY_KEY, USER.id)
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  assert.deepEqual(calls, ["readToken", "api.session"])
})

test("signing in as another account purges before the token is stored, then refetches what the guest cached", async () => {
  memory.set(LAST_IDENTITY_KEY, OTHER.id)
  const store = await freshStore()
  await store.getState().signIn("tok", USER as never)
  assert.deepEqual(calls, ["purgeQueryCache", "clearSecureBlobs", "setToken:tok", ...VIEWER_REFETCH])
  assert.equal(store.getState().status, "authed")
  assert.equal(memory.get(LAST_IDENTITY_KEY), USER.id)
})

test("sign-out unregisters push, revokes the session, tears down, forgets the identity, clears blobs, then the token", async () => {
  control.token = { ok: true, token: "tok" }
  memory.set(LAST_IDENTITY_KEY, USER.id)
  memory.set(PUSH_REGISTRATION_KEY, JSON.stringify({ platform: "ios", token: "ExponentPushToken[x]" }))
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  calls.length = 0
  await store.getState().signOut()
  assert.deepEqual(calls, [
    "readToken",
    "api.pushUnregister:ExponentPushToken[x]:Bearer tok",
    "api.logout:Bearer tok",
    ...TEARDOWN,
    "clearSecureBlobs",
    "clearToken",
  ])
  assert.equal(memory.has(PUSH_REGISTRATION_KEY), false)
  assert.equal(memory.has(LAST_IDENTITY_KEY), false)
  assert.equal(store.getState().status, "unauthed")
})

test("sign-out still completes locally when the revoke fails and when there is no token", async () => {
  control.token = { ok: true, token: "tok" }
  control.logout = async () => {
    throw new TypeError("offline")
  }
  const store = await freshStore()
  await store.getState().signOut()
  assert.deepEqual(calls, ["readToken", "api.logout:Bearer tok", ...TEARDOWN, "clearSecureBlobs", "clearToken"])

  resetStubs()
  const signedOut = await freshStore()
  await signedOut.getState().signOut()
  assert.deepEqual(calls, ["readToken", ...TEARDOWN, "clearSecureBlobs", "clearToken"])
})

test("markUnauthed tears down once and is a no-op after a teardown", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = signedInSession(USER)
  const store = await freshStore()
  await store.getState().hydrate()
  calls.length = 0
  store.getState().markUnauthed()
  store.getState().markUnauthed()
  await settle()
  assert.deepEqual(calls, TEARDOWN)
  assert.equal(store.getState().status, "unauthed")
})

test("a foreground retry re-hydrates only an unauthed store whose identity was never torn down and still has a token", async () => {
  control.token = { ok: false }
  const store = await freshStore()
  await store.getState().hydrate()
  await settle()
  control.token = { ok: true, token: "tok" }
  control.session = signedInSession(USER)
  calls.length = 0
  await store.getState().retryHydration()
  assert.deepEqual(calls, ["readToken", "readToken", "api.session"])
  assert.equal(store.getState().status, "authed")

  calls.length = 0
  await store.getState().retryHydration()
  assert.deepEqual(calls, [])
})

test("a foreground retry does nothing after a teardown or when the token is gone", async () => {
  const tornDown = await freshStore()
  await tornDown.getState().hydrate()
  await settle()
  calls.length = 0
  control.token = { ok: true, token: "tok" }
  await tornDown.getState().retryHydration()
  assert.deepEqual(calls, [])

  resetStubs()
  control.token = { ok: false }
  const unreadable = await freshStore()
  await unreadable.getState().hydrate()
  await settle()
  control.token = { ok: true, token: null }
  calls.length = 0
  await unreadable.getState().retryHydration()
  assert.deepEqual(calls, ["readToken"])
  assert.equal(unreadable.getState().status, "unauthed")
})

test("overlapping session-restore retries run one boot hydration", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = signedInSession(USER)
  const store = await freshStore()
  await Promise.all([store.getState().retrySessionRestore(), store.getState().retrySessionRestore()])
  assert.deepEqual(calls, ["readToken", "api.session"])
  assert.equal(store.getState().networkOutcome, "ok")
})

test("a boot hydration resets the network outcome to pending until the server answers", async () => {
  control.token = { ok: true, token: "tok" }
  let answer: (value: unknown) => void = () => undefined
  control.session = () => new Promise((resolve) => (answer = resolve))
  memory.set(CACHED_USER_KEY, JSON.stringify(USER))
  const store = await freshStore()
  store.setState({ networkOutcome: "ok" })
  const pending = store.getState().hydrate()
  await settle()
  assert.equal(store.getState().networkOutcome, "pending")
  assert.equal(store.getState().status, "authed")
  answer({ authenticated: true, user: USER, guestSmsEnabled: false })
  await pending
  assert.equal(store.getState().networkOutcome, "ok")
})
