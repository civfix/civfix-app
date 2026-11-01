import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { expectConsoleWarn } from "@civfix/testing/console"
import { syncAndroidChannels } from "./channels.ts"

test("a retired channel that cannot be deleted does not stop the other deletion", async () => {
  expectConsoleWarn("host_broadcasts")
  const deleteChannel = mock.fn(async (id: string): Promise<unknown> => {
    if (id === "host_broadcasts") throw new Error("busy")
    return undefined
  })
  await syncAndroidChannels({
    t: (key) => key,
    defaultImportance: 5,
    lightColor: "#ff00aa",
    setChannel: async () => null,
    deleteChannel,
  })
  assert.deepEqual(
    deleteChannel.mock.calls.map((call) => call.arguments[0]),
    ["host_broadcasts", "event_reminders"],
  )
})
