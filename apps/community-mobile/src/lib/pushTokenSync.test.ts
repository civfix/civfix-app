import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { AppError, ErrorCode, type RegisterPushTokenRequest } from "@civfix/contract"
import type { PushPermissionStatus } from "@civfix/ui/capabilities"
import type { DevicePushToken } from "expo-notifications"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"
import { memoryKeyValueStore } from "./memoryKeyValueStore.ts"

installModuleStubs({})

const { PUSH_ASKED_KEY, promptForPushAtSignIn, syncPushToken } = await import("./pushTokenSync.ts")
const { PUSH_REGISTRATION_KEY } = await import("./pushRegistration.ts")

const PREVIOUS = JSON.stringify({ platform: "android", token: "fcm-token-0" })

function syncDeps(
  status: PushPermissionStatus,
  options: {
    token?: DevicePushToken
    register?: (body: RegisterPushTokenRequest) => Promise<unknown>
  } = {},
) {
  const store = memoryKeyValueStore()
  store.set(PUSH_REGISTRATION_KEY, PREVIOUS)
  return {
    store,
    permission: {
      status: mock.fn(async (): Promise<PushPermissionStatus> => status),
      request: mock.fn(async (): Promise<PushPermissionStatus> => "granted"),
    },
    getDevicePushToken: mock.fn(
      async (): Promise<DevicePushToken> =>
        options.token ?? { type: "android", data: "fcm-token-1" },
    ),
    deviceId: mock.fn(async (): Promise<string | null> => "dev-1"),
    registerPush: mock.fn(options.register ?? (async () => ({ ok: true }))),
  }
}

test("T1: a granted Android device registers its FCM token and remembers it", async () => {
  const deps = syncDeps("granted")
  const result = await syncPushToken(deps)
  assert.equal(deps.registerPush.mock.callCount(), 1)
  assert.deepEqual(deps.registerPush.mock.calls[0]?.arguments, [
    { platform: "android", token: "fcm-token-1", deviceId: "dev-1" },
  ])
  assert.equal(
    deps.store.getString(PUSH_REGISTRATION_KEY),
    JSON.stringify({ platform: "android", token: "fcm-token-1" }),
  )
  assert.deepEqual(result, { status: "registered", token: "fcm-token-1" })
})

test("T2: a granted iPhone registers its raw APNs hex token", async () => {
  const hex = "a1b2c3d4" + "0123456789abcdef".repeat(3) + "01234567"
  assert.equal(hex.length, 64)
  const deps = syncDeps("granted", { token: { type: "ios", data: hex } })
  await syncPushToken(deps)
  const body = deps.registerPush.mock.calls[0]?.arguments[0]
  assert.equal(body?.platform, "ios")
  assert.equal(body?.token, hex)
})

test("T3: without a grant nothing is fetched, registered or asked, and the record stays", async () => {
  const expected: Record<string, string> = {
    denied: "denied",
    undetermined: "denied",
    unsupported: "unsupported",
  }
  for (const status of ["denied", "undetermined", "unsupported"] as const) {
    const deps = syncDeps(status)
    const result = await syncPushToken(deps)
    assert.equal(deps.getDevicePushToken.mock.callCount(), 0, status)
    assert.equal(deps.registerPush.mock.callCount(), 0, status)
    assert.equal(deps.permission.request.mock.callCount(), 0, status)
    assert.equal(result.status, expected[status], status)
    assert.equal(deps.store.getString(PUSH_REGISTRATION_KEY), PREVIOUS, status)
  }
})

test("T4: a rotated token is registered as given, without fetching one", async () => {
  const deps = syncDeps("granted")
  await syncPushToken(deps, { type: "android", data: "fcm-token-2" })
  assert.equal(deps.getDevicePushToken.mock.callCount(), 0)
  assert.equal(deps.registerPush.mock.calls[0]?.arguments[0]?.token, "fcm-token-2")
  assert.equal(
    deps.store.getString(PUSH_REGISTRATION_KEY),
    JSON.stringify({ platform: "android", token: "fcm-token-2" }),
  )
})

test("T5: a 409 from registerPush resolves conflict and keeps the record", async () => {
  const deps = syncDeps("granted", {
    register: async () => {
      throw new AppError(ErrorCode.CONFLICT, "owned by another account")
    },
  })
  const result = await syncPushToken(deps)
  assert.equal(result.status, "conflict")
  assert.equal(deps.store.getString(PUSH_REGISTRATION_KEY), PREVIOUS)
})

test("T6: a network error resolves error without throwing and keeps the record", async () => {
  const deps = syncDeps("granted", {
    register: async () => {
      throw new TypeError("Network request failed")
    },
  })
  const result = await syncPushToken(deps)
  assert.equal(result.status, "error")
  assert.equal(deps.store.getString(PUSH_REGISTRATION_KEY), PREVIOUS)
})

function promptDeps(status: PushPermissionStatus, asked: boolean) {
  const store = memoryKeyValueStore()
  if (asked) store.set(PUSH_ASKED_KEY, "1")
  const askedWhenRequested: (string | undefined)[] = []
  return {
    store,
    askedWhenRequested,
    permission: {
      status: mock.fn(async (): Promise<PushPermissionStatus> => status),
      request: mock.fn(async (): Promise<PushPermissionStatus> => {
        askedWhenRequested.push(store.getString(PUSH_ASKED_KEY))
        return "granted"
      }),
    },
  }
}

test("T7: a device never asked records the ask before it shows the prompt, once", async () => {
  const deps = promptDeps("undetermined", false)
  const result = await promptForPushAtSignIn(deps)
  assert.equal(deps.permission.request.mock.callCount(), 1)
  assert.equal(deps.askedWhenRequested.length, 1)
  assert.notEqual(deps.askedWhenRequested[0], undefined)
  assert.equal(result, "granted")
})

test("T8: a device already asked is not asked again", async () => {
  const deps = promptDeps("undetermined", true)
  const result = await promptForPushAtSignIn(deps)
  assert.equal(deps.permission.request.mock.callCount(), 0)
  assert.equal(result, "undetermined")
})

test("T9: a decided device is never prompted, and counts as asked", async () => {
  for (const status of ["denied", "granted"] as const) {
    const deps = promptDeps(status, false)
    const result = await promptForPushAtSignIn(deps)
    assert.equal(deps.permission.request.mock.callCount(), 0, status)
    assert.notEqual(deps.store.getString(PUSH_ASKED_KEY), undefined, status)
    assert.equal(result, status)
  }
})

test("T10: the .dev variant is neither prompted nor marked asked", async () => {
  const deps = promptDeps("unsupported", false)
  const result = await promptForPushAtSignIn(deps)
  assert.equal(deps.permission.request.mock.callCount(), 0)
  assert.equal(deps.store.getString(PUSH_ASKED_KEY), undefined)
  assert.equal(result, "unsupported")
})
