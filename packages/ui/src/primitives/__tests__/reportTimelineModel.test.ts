import { describe, expect, it } from "vitest"
import { timelineEntryRender, visibilityKindOf } from "../reportTimelineModel"

describe("visibilityKindOf", () => {
  it("recognizes only the two visibility kinds", () => {
    expect(visibilityKindOf("hidden")).toBe("hidden")
    expect(visibilityKindOf("unhidden")).toBe("unhidden")
    expect(visibilityKindOf("status")).toBeNull()
    expect(visibilityKindOf(undefined)).toBeNull()
    expect(visibilityKindOf(null)).toBeNull()
  })
})

describe("timelineEntryRender", () => {
  it("renders an owner hide/re-list as its own visibility node, never as a status change", () => {
    expect(
      timelineEntryRender(
        { status: "published", kind: "hidden", note: "Hidden from the public map by the reporter" },
        1,
        "published",
      ),
    ).toBe("hidden")
    expect(
      timelineEntryRender(
        { status: "published", kind: "unhidden", note: "Re-listed by the reporter" },
        2,
        "published",
      ),
    ).toBe("unhidden")
  })

  it("keeps a visibility node even at index 0 and on a non-published status", () => {
    expect(timelineEntryRender({ status: "held", kind: "hidden" }, 0, null)).toBe("hidden")
  })

  it("reopens only when the report actually returns from resolved or rejected", () => {
    expect(timelineEntryRender({ status: "published" }, 1, "resolved")).toBe("reopened")
    expect(timelineEntryRender({ status: "published" }, 1, "rejected")).toBe("reopened")
    expect(timelineEntryRender({ status: "resolved" }, 1, "published")).toBe("status")
  })

  it("skips the opening submitted/held/published row the header already renders", () => {
    expect(timelineEntryRender({ status: "submitted" }, 0, null)).toBe("skip")
    expect(timelineEntryRender({ status: "held" }, 0, null)).toBe("skip")
    expect(timelineEntryRender({ status: "published" }, 0, null)).toBe("skip")
    expect(timelineEntryRender({ status: "held", note: "Awaiting automated review" }, 1, "submitted")).toBe(
      "status",
    )
  })

  it("still renders a city reply on a published report", () => {
    expect(
      timelineEntryRender(
        { status: "published", kind: "reply", note: "Jurisdiction replied", body: "We are on it" },
        3,
        "published",
      ),
    ).toBe("reply")
  })

  it("renders a kind-tagged no-op row as a note node, never as a false status change", () => {
    expect(
      timelineEntryRender(
        { status: "published", kind: "route", note: "Routed to Public Works" },
        2,
        "published",
      ),
    ).toBe("note")
    expect(
      timelineEntryRender(
        { status: "published", kind: "anon_release", note: "Released after automated review" },
        1,
        "published",
      ),
    ).toBe("note")
    expect(timelineEntryRender({ status: "published", kind: "route" }, 2, "published")).toBe("skip")
  })

  it("renders a legacy kindless no-op row as a note node, and drops it when there is none", () => {
    expect(
      timelineEntryRender(
        { status: "published", note: "Hidden from the public map by the reporter" },
        1,
        "published",
      ),
    ).toBe("note")
    expect(timelineEntryRender({ status: "published" }, 1, "published")).toBe("skip")
  })
})
