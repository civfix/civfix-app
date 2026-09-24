import { describe, expect, it } from "vitest"

import { consoleKeys } from "./console-keys"

const EVENT_ID = "33333333-3333-4333-8333-333333333333"

describe("consoleKeys.broadcastsRoot", () => {
  it("prefixes the list, the detail and the deliveries, so one invalidation refreshes all", () => {
    const root = consoleKeys.broadcastsRoot(EVENT_ID)
    for (const key of [
      consoleKeys.broadcasts(EVENT_ID),
      consoleKeys.broadcast(EVENT_ID, "b1"),
      consoleKeys.deliveries(EVENT_ID, "b1", "all"),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root])
    }
  })
})
