import { describe, expect, it } from "vitest"
import { eventStatusLine } from "../eventDetailModel"

const base = { isCancelled: false, isDone: false, isOrganizer: false, isCohost: false }

describe("eventStatusLine", () => {
  it("says nothing for a live event the viewer does not host", () => {
    expect(eventStatusLine(base)).toBeNull()
  })

  it("names the viewer's hosting role on a live event", () => {
    expect(eventStatusLine({ ...base, isOrganizer: true })).toEqual({ key: "status.hosting", tone: "live" })
    expect(eventStatusLine({ ...base, isCohost: true })).toEqual({ key: "status.cohosting", tone: "live" })
  })

  it("lets the event's lifecycle outrank the viewer's role", () => {
    expect(eventStatusLine({ ...base, isCancelled: true, isOrganizer: true })).toEqual({
      key: "status.cancelled",
      tone: "cancelled",
    })
    expect(eventStatusLine({ ...base, isDone: true, isCohost: true })).toEqual({
      key: "status.ended",
      tone: "ended",
    })
    expect(eventStatusLine({ ...base, isCancelled: true, isDone: true })?.key).toBe("status.cancelled")
  })
})
