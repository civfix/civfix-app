import { test, mock } from "node:test"
import assert from "node:assert/strict"
import type { DevicePushToken } from "expo-notifications"
import { memoryKeyValueStore } from "./memoryKeyValueStore.ts"
import { PUSH_REGISTRATION_KEY } from "./pushRegistration.ts"
import { syncPushToken } from "./pushTokenSync.ts"

function deps(token: DevicePushToken) {
  return {
    store: memoryKeyValueStore(),
    permission: {
      status: async () => "granted" as const,
      request: async () => "granted" as const,
    },
    getDevicePushToken: async () => token,
    deviceId: async (): Promise<string | null> => null,
    registerPush: mock.fn(async () => ({ ok: true })),
  }
}

test("a web subscription is not a native token and is never registered", async () => {
  const d = deps({
    type: "web",
    data: { endpoint: "https://push.example/1", keys: { p256dh: "k", auth: "a" } },
  })
  const result = await syncPushToken(d)
  assert.equal(result.status, "unsupported")
  assert.equal(d.registerPush.mock.callCount(), 0)
})

test("an empty token is an error, never registered or remembered", async () => {
  const d = deps({ type: "android", data: "" })
  assert.deepEqual(await syncPushToken(d), { status: "error", reason: "empty push token" })
  assert.equal(d.registerPush.mock.callCount(), 0)
  assert.equal(d.store.getString(PUSH_REGISTRATION_KEY), undefined)
})

test("without a device id the registration leaves deviceId out", async () => {
  const d = deps({ type: "ios", data: "abc123" })
  await syncPushToken(d)
  assert.deepEqual(d.registerPush.mock.calls[0]?.arguments, [{ platform: "ios", token: "abc123" }])
})
