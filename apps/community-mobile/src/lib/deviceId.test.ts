/**
 * Pure-logic tests for resolveDeviceId. Run with the Node built-in test runner + type stripping:
 *   node --experimental-strip-types --test src/lib/deviceId.test.ts
 * No native modules are imported (the SecureStore/Crypto seams are injected as fakes), so this runs
 * outside the Metro/Expo runtime. Excluded from the app tsc/eslint via tsconfig.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveDeviceId, DEVICE_ID_KEY, type DeviceIdStore } from "./deviceId.ts"

function makeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const writes: { key: string; value: string }[] = []
  const store: DeviceIdStore = {
    async read(key) {
      return data.get(key) ?? null
    },
    async write(key, value) {
      writes.push({ key, value })
      data.set(key, value)
    },
  }
  return { store, data, writes }
}

test("returns the existing persisted device id without regenerating", async () => {
  const { store, writes } = makeStore({ [DEVICE_ID_KEY]: "existing-id" })
  const id = await resolveDeviceId(store, () => "NEW-SHOULD-NOT-BE-USED")
  assert.equal(id, "existing-id")
  assert.equal(writes.length, 0)
})

test("generates, persists, and returns a new id when none is stored", async () => {
  const { store, data, writes } = makeStore()
  const id = await resolveDeviceId(store, () => "generated-uuid")
  assert.equal(id, "generated-uuid")
  assert.equal(data.get(DEVICE_ID_KEY), "generated-uuid")
  assert.equal(writes.length, 1)
})

test("is stable across calls — reuses the id it persisted", async () => {
  const { store } = makeStore()
  let n = 0
  const gen = () => `uuid-${n++}`
  const first = await resolveDeviceId(store, gen)
  const second = await resolveDeviceId(store, gen)
  assert.equal(first, "uuid-0")
  assert.equal(second, "uuid-0")
})

test("returns null when the secure store is unavailable (no crash, no device id)", async () => {
  const store: DeviceIdStore = {
    async read() {
      throw new Error("keychain unavailable")
    },
    async write() {
      /* unreached */
    },
  }
  const id = await resolveDeviceId(store, () => "x")
  assert.equal(id, null)
})
