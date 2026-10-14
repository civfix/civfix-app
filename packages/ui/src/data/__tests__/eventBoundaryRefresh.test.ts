import { describe, expect, it } from "vitest"
import { eventBoundaryCrossed } from "../useEventBoundaryRefresh"

describe("eventBoundaryCrossed", () => {
  it("fires when the same event moves across a lifecycle boundary", () => {
    expect(eventBoundaryCrossed({ cleanupId: "e1", status: "upcoming" }, { cleanupId: "e1", status: "active" })).toBe(true)
  })

  it("does not fire while the status holds", () => {
    expect(eventBoundaryCrossed({ cleanupId: "e1", status: "active" }, { cleanupId: "e1", status: "active" })).toBe(false)
  })

  it("does not fire when the body switches to a different event with a different status", () => {
    expect(eventBoundaryCrossed({ cleanupId: "e1", status: "upcoming" }, { cleanupId: "e2", status: "done" })).toBe(
      false,
    )
  })

  it("does not fire when the event window first loads", () => {
    expect(eventBoundaryCrossed({ cleanupId: "e1", status: null }, { cleanupId: "e1", status: "active" })).toBe(false)
  })
})
