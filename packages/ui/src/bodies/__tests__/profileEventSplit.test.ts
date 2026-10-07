/**
 * The profile carries `upcomingEvents` beside a strictly-past `pastEvents`. Each list feeds its own pair
 * of buckets and is split only by organizer - no time predicate runs, so a past list is never re-sliced
 * and a future-dated row the server put in `pastEvents` still renders.
 */
import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { splitProfileEvents } from "../profile/profileEventSplit"

function event(id: string, scheduledAt: string, organizerId: string): CleanupDTO {
  return { id, scheduledAt, organizer: { id: organizerId } } as unknown as CleanupDTO
}

describe("splitProfileEvents (modern: upcomingEvents present)", () => {
  it("fills the upcoming buckets from upcomingEvents and the past buckets from pastEvents", () => {
    const split = splitProfileEvents(
      [
        event("c", "2026-01-02T10:00:00.000Z", "me"),
        event("d", "2026-01-03T10:00:00.000Z", "someone"),
      ],
      [
        event("a", "2026-08-01T10:00:00.000Z", "me"),
        event("b", "2026-08-02T10:00:00.000Z", "someone"),
      ],
      "me",
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing.map((e) => e.id)).toEqual(["b"])
    expect(split.pastHosted.map((e) => e.id)).toEqual(["c"])
    expect(split.pastAttended.map((e) => e.id)).toEqual(["d"])
  })

  it("never re-slices the past list by time (a future-dated past row stays past)", () => {
    const split = splitProfileEvents([event("x", "2026-08-01T10:00:00.000Z", "me")], [], "me")

    expect(split.pastHosted.map((e) => e.id)).toEqual(["x"])
    expect(split.upcomingHosting).toEqual([])
  })

  it("treats an EMPTY upcoming array as the modern path, not as a missing field", () => {
    const split = splitProfileEvents(
      [event("p", "2026-01-02T10:00:00.000Z", "me")],
      [],
      "me",
    )

    expect(split.upcomingHosting).toEqual([])
    expect(split.upcomingGoing).toEqual([])
    expect(split.pastHosted.map((e) => e.id)).toEqual(["p"])
  })

  it("leaves upcomingGoing empty for a public viewer (server sends hosting-only)", () => {
    const split = splitProfileEvents(
      [],
      [event("a", "2026-08-01T10:00:00.000Z", "them")],
      "them",
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing).toEqual([])
  })

  it("preserves the source order within each bucket", () => {
    const split = splitProfileEvents(
      [],
      [
        event("a", "2026-08-03T10:00:00.000Z", "me"),
        event("b", "2026-08-01T10:00:00.000Z", "me"),
      ],
      "me",
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a", "b"])
  })
})

describe("splitProfileEvents before the profile has loaded", () => {
  it("reads a missing upcomingEvents as nothing upcoming and still never re-slices the past list", () => {
    const split = splitProfileEvents(
      [
        event("a", "2026-08-01T10:00:00.000Z", "me"),
        event("b", "2026-01-03T10:00:00.000Z", "someone"),
      ],
      undefined,
      "me",
    )

    expect(split.upcomingHosting).toEqual([])
    expect(split.upcomingGoing).toEqual([])
    expect(split.pastHosted.map((e) => e.id)).toEqual(["a"])
    expect(split.pastAttended.map((e) => e.id)).toEqual(["b"])
  })
})
