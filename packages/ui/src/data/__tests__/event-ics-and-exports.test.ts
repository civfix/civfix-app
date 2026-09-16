import { describe, expect, it, vi } from "vitest"
import { queryKeys } from "../keys"
import { invalidationKeysForTopic } from "../signals"
import { fetchEventIcs } from "../eventIcs"

describe("queryKeys.eventIcs", () => {
  it("is a CHILD of the event, so a reschedule invalidates the calendar file with it", () => {
    const prefix = queryKeys.cleanup("e1")
    expect(queryKeys.eventIcs("e1").slice(0, prefix.length)).toEqual([...prefix])
  })

  it("keeps two events' documents apart", () => {
    expect(queryKeys.eventIcs("e1")).not.toEqual(queryKeys.eventIcs("e2"))
  })
})

describe("the host realtime topic does not pretend to cover exports", () => {
  it("still resolves to the event subtree only - nothing publishes a signal when an export is ready", () => {
    expect(invalidationKeysForTopic("host", undefined, "e1")).toEqual([queryKeys.hostEvent("e1")])
    expect(invalidationKeysForTopic("host", undefined, "e1").flat()).not.toContain("host-exports")
  })
})

describe("fetchEventIcs", () => {
  it("goes through the typed client with the event id, and returns the document as served", async () => {
    const getEventIcs = vi.fn().mockResolvedValue({ ics: "BEGIN:VCALENDAR", filename: "e1.ics" })
    const served = await fetchEventIcs({ getEventIcs } as never, "e1")
    expect(getEventIcs).toHaveBeenCalledWith({ id: "e1" })
    expect(served).toEqual({ ics: "BEGIN:VCALENDAR", filename: "e1.ics" })
  })

  it("propagates a refusal instead of inventing a document", async () => {
    const getEventIcs = vi.fn().mockRejectedValue(new Error("404"))
    await expect(fetchEventIcs({ getEventIcs } as never, "e1")).rejects.toThrow("404")
  })
})
