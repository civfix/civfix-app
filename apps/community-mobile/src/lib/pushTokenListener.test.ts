import { test, mock } from "node:test"
import assert from "node:assert/strict"
import type { DevicePushToken } from "expo-notifications"
import { memoryKeyValueStore } from "./memoryKeyValueStore.ts"
import { PUSH_REGISTRATION_KEY } from "./pushRegistration.ts"
import { makeSerialPushSync, syncPushToken } from "./pushTokenSync.ts"

const TOKEN: DevicePushToken = { type: "android", data: "fcm-token-1" }

// Wired the way usePushOnSignIn wires it: expo-notifications reports a fetched token to the push token
// listener as well, while the registration that fetched it is still waiting on registerPush.
function wiredSync(listenerToken: DevicePushToken = TOKEN) {
  const store = memoryKeyValueStore()
  const registerPush = mock.fn(async () => {
    await new Promise((resolve) => setImmediate(resolve))
    return { ok: true }
  })
  const run = makeSerialPushSync(async (rotated) => {
    await syncPushToken(
      {
        store,
        permission: { status: async () => "granted", request: async () => "granted" },
        getDevicePushToken: async () => {
          void run(listenerToken)
          return TOKEN
        },
        deviceId: async () => null,
        registerPush,
      },
      rotated,
    )
  })
  return { store, registerPush, run }
}

test("a token fetch that the listener echoes registers once", async () => {
  const { registerPush, run } = wiredSync()
  await run()
  assert.equal(registerPush.mock.callCount(), 1)
})

test("a different token the listener reports meanwhile is registered after the first", async () => {
  const { store, registerPush, run } = wiredSync({ type: "android", data: "fcm-token-2" })
  await run()
  assert.deepEqual(
    registerPush.mock.calls.map((call) => (call.arguments as unknown[])[0]),
    [
      { platform: "android", token: "fcm-token-1" },
      { platform: "android", token: "fcm-token-2" },
    ],
  )
  assert.equal(
    store.getString(PUSH_REGISTRATION_KEY),
    JSON.stringify({ platform: "android", token: "fcm-token-2" }),
  )
})

test("a fetched token is sent again even when it matches the last one sent", async () => {
  const { registerPush, run } = wiredSync()
  await run()
  await run()
  assert.equal(registerPush.mock.callCount(), 2)
})
