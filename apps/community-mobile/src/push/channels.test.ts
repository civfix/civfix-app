import { test, mock } from "node:test"
import assert from "node:assert/strict"
import type { NotificationChannelInput } from "expo-notifications"
import { expectConsoleWarn } from "@civfix/testing/console"
import { syncAndroidChannels } from "./channels.ts"

const DEFAULT_IMPORTANCE = 5

function deps(failFor?: string) {
  return {
    t: (key: string) => key,
    defaultImportance: DEFAULT_IMPORTANCE,
    lightColor: "#ff00aa",
    setChannel: mock.fn(
      async (id: string, _channel: NotificationChannelInput): Promise<unknown> => {
        if (id === failFor) throw new Error(`cannot create ${id}`)
        return null
      },
    ),
    deleteChannel: mock.fn(async (_id: string): Promise<unknown> => undefined),
  }
}

test("T14: the default channel and the five section channels are set in order, the retired two deleted", async () => {
  const d = deps()
  await syncAndroidChannels(d)
  const set = d.setChannel.mock.calls.map((call) => call.arguments)
  assert.deepEqual(
    set.map(([id]) => id),
    ["default", "reports", "messages", "events", "social", "organizations"],
  )
  for (const [id, channel] of set) {
    assert.equal(channel.name, `notification_channel_${id}`)
    assert.equal(channel.importance, DEFAULT_IMPORTANCE, id)
  }
  const deleted = d.deleteChannel.mock.calls.map((call) => call.arguments[0])
  assert.deepEqual([...deleted].sort(), ["event_reminders", "host_broadcasts"])
  assert.equal(deleted.includes("default"), false)
})

test("T15: one channel that fails does not stop the rest or the deletions", async () => {
  expectConsoleWarn("messages")
  const d = deps("messages")
  await syncAndroidChannels(d)
  const set = d.setChannel.mock.calls.map((call) => call.arguments[0])
  for (const id of ["default", "reports", "events", "social", "organizations"]) {
    assert.ok(set.includes(id), id)
  }
  const deleted = d.deleteChannel.mock.calls.map((call) => call.arguments[0])
  assert.deepEqual([...deleted].sort(), ["event_reminders", "host_broadcasts"])
})
