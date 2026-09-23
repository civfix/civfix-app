/**
 * splitProfileEvents covers TWO server generations at once, so both are pinned here.
 *
 *  - MODERN (contract 0.38+): the profile carries `upcomingEvents` beside a strictly-past `pastEvents`.
 *    Each list feeds its own pair of buckets and is split only by organizer - no time predicate runs, so a
 *    past list is never re-sliced and a future-dated row the server put in `pastEvents` still renders.
 *  - LEGACY (0.37 and older): no `upcomingEvents` field at all, and `pastEvents` carries future events
 *    too. Passing `undefined` selects the time-based split.
 *
 * The distinction that bites: an EMPTY upcoming array is the modern path (the server answered "nothing
 * upcoming"), NOT the legacy one. Only `undefined` means "this server does not send the field".
 */
import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { splitProfileEvents } from "../profile/profileEventSplit"

const NOW = Date.parse("2026-07-24T12:00:00.000Z")

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
      NOW,
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing.map((e) => e.id)).toEqual(["b"])
    expect(split.pastHosted.map((e) => e.id)).toEqual(["c"])
    expect(split.pastAttended.map((e) => e.id)).toEqual(["d"])
  })

  it("never re-slices the past list by time (a future-dated past row stays past)", () => {
    const split = splitProfileEvents([event("x", "2026-08-01T10:00:00.000Z", "me")], [], "me", NOW)

    expect(split.pastHosted.map((e) => e.id)).toEqual(["x"])
    expect(split.upcomingHosting).toEqual([])
  })

  it("treats an EMPTY upcoming array as the modern path, not as a missing field", () => {
    const split = splitProfileEvents(
      [event("p", "2026-01-02T10:00:00.000Z", "me")],
      [],
      "me",
      NOW,
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
      NOW,
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
      NOW,
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a", "b"])
  })
})

describe("splitProfileEvents (legacy: upcomingEvents undefined)", () => {
  it("splits upcoming / past by schedule and hosting / attending by organizer", () => {
    const split = splitProfileEvents(
      [
        event("a", "2026-08-01T10:00:00.000Z", "me"),
        event("b", "2026-08-02T10:00:00.000Z", "someone"),
        event("c", "2026-01-02T10:00:00.000Z", "me"),
        event("d", "2026-01-03T10:00:00.000Z", "someone"),
      ],
      undefined,
      "me",
      NOW,
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing.map((e) => e.id)).toEqual(["b"])
    expect(split.pastHosted.map((e) => e.id)).toEqual(["c"])
    expect(split.pastAttended.map((e) => e.id)).toEqual(["d"])
  })

  it("counts an event scheduled exactly now as upcoming", () => {
    const split = splitProfileEvents(
      [event("a", new Date(NOW).toISOString(), "me")],
      undefined,
      "me",
      NOW,
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.pastHosted).toEqual([])
  })

  it("keeps a schedule it cannot read out of Past - the shared clock fails closed on 'has it ended'", () => {
    const split = splitProfileEvents([event("a", "not-a-date", "someone")], undefined, "me", NOW)

    expect(split.upcomingGoing.map((e) => e.id)).toEqual(["a"])
    expect(split.pastAttended).toEqual([])
  })

  it("preserves the source order within each bucket", () => {
    const split = splitProfileEvents(
      [
        event("a", "2026-08-03T10:00:00.000Z", "me"),
        event("b", "2026-08-01T10:00:00.000Z", "me"),
      ],
      undefined,
      "me",
      NOW,
    )

    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a", "b"])
  })
})
