import { test } from "node:test"
import assert from "node:assert/strict"
import type { DevicePushToken } from "expo-notifications"
import { makeSerialPushSync } from "./pushTokenSync.ts"

function gatedSync() {
  const runs: (string | undefined)[] = []
  const gates: (() => void)[] = []
  const sync = async (rotated?: DevicePushToken): Promise<void> => {
    runs.push(rotated?.data as string | undefined)
    await new Promise<void>((resolve) => gates.push(resolve))
  }
  return { runs, gates, sync }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

test("one registration runs at a time; triggers meanwhile collapse into one more run", async () => {
  const { runs, gates, sync } = gatedSync()
  const run = makeSerialPushSync(sync)
  const first = run()
  void run()
  void run()
  await settle()
  assert.deepEqual(runs, [undefined])
  gates.shift()?.()
  await settle()
  assert.deepEqual(runs, [undefined, undefined])
  gates.shift()?.()
  await first
  assert.equal(gates.length, 0)
})

test("a token rotated while a registration runs is the one the next run registers", async () => {
  const { runs, gates, sync } = gatedSync()
  const run = makeSerialPushSync(sync)
  const first = run()
  void run({ type: "android", data: "fcm-token-2" })
  void run()
  await settle()
  gates.shift()?.()
  await settle()
  assert.deepEqual(runs, [undefined, "fcm-token-2"])
  gates.shift()?.()
  await first
})

test("a later trigger starts a fresh run once the last one finished", async () => {
  const { runs, gates, sync } = gatedSync()
  const run = makeSerialPushSync(sync)
  const first = run()
  await settle()
  gates.shift()?.()
  await first
  const second = run({ type: "ios", data: "apns" })
  await settle()
  gates.shift()?.()
  await second
  assert.deepEqual(runs, [undefined, "apns"])
})
