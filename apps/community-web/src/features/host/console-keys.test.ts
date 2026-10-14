import { queryKeys } from "@civfix/ui/data"
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

describe("roster and answers keys", () => {
  it("keep the byte-identical arrays the console has always cached under", () => {
    expect(consoleKeys.rosterRoot(EVENT_ID)).toEqual(["host", EVENT_ID, "roster"])
    expect(consoleKeys.roster(EVENT_ID, "all", "name_asc", "ada", null)).toEqual([
      "host",
      EVENT_ID,
      "roster",
      "console",
      "all",
      "name_asc",
      "ada",
      "all",
    ])
    expect(consoleKeys.roster(EVENT_ID, "all", "name_asc", "", "t1")[7]).toBe("t1")
    expect(consoleKeys.answers(EVENT_ID, "r1")).toEqual(["host", EVENT_ID, "answers", "r1"])
  })

  it("sit under the event prefix, so invalidating the event reaches them", () => {
    const event = queryKeys.hostEvent(EVENT_ID)
    const root = consoleKeys.rosterRoot(EVENT_ID)
    const roster = consoleKeys.roster(EVENT_ID, "all", "name_asc", "", null)
    expect(roster.slice(0, root.length)).toEqual([...root])
    for (const key of [root, consoleKeys.answers(EVENT_ID, "r1")]) {
      expect(key.slice(0, event.length)).toEqual([...event])
    }
  })
})

describe("the shared keys console-invalidate uses", () => {
  it("are the arrays it used to spell out inline", () => {
    expect(queryKeys.hostEvent(EVENT_ID)).toEqual(["host", EVENT_ID])
    expect(queryKeys.cleanup(EVENT_ID)).toEqual(["cleanup", EVENT_ID])
    expect(queryKeys.hostCounters(EVENT_ID)).toEqual(["host", EVENT_ID, "counters"])
    expect(queryKeys.myOrganizations).toEqual(["orgs", "mine"])
    expect(queryKeys.hostedEventsAnalytics("90d", null)).toEqual([
      "hosted-events",
      "analytics",
      "90d",
      "all",
    ])
  })
})
