import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { DEFAULT_EVENT_DURATION_MS } from "@civfix/shared/host"
import { splitProfileEvents } from "../profile/profileEventSplit"

const NOW = Date.parse("2026-07-24T12:00:00.000Z")
const HOUR = 3_600_000

function event(
  id: string,
  scheduledAt: string,
  organizerId: string,
  endsAt?: string | null,
): CleanupDTO {
  return { id, scheduledAt, endsAt, organizer: { id: organizerId } } as unknown as CleanupDTO
}

const at = (ms: number): string => new Date(ms).toISOString()

describe("splitProfileEvents legacy path uses the event END, not its start", () => {
  it("keeps an event that started an hour ago and has no end in Upcoming", () => {
    const split = splitProfileEvents([event("a", at(NOW - HOUR), "me")], undefined, "me", NOW)
    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.pastHosted).toEqual([])
  })

  it("moves an end-less event to Past once the default duration has elapsed", () => {
    const split = splitProfileEvents(
      [event("a", at(NOW - DEFAULT_EVENT_DURATION_MS), "me")],
      undefined,
      "me",
      NOW,
    )
    expect(split.pastHosted.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingHosting).toEqual([])
  })

  it("keeps an end-less event in Upcoming one millisecond before the default duration elapses", () => {
    const split = splitProfileEvents(
      [event("a", at(NOW - DEFAULT_EVENT_DURATION_MS + 1), "someone")],
      undefined,
      "me",
      NOW,
    )
    expect(split.upcomingGoing.map((e) => e.id)).toEqual(["a"])
  })

  it("honours an explicit endsAt that is earlier than the default duration", () => {
    const split = splitProfileEvents(
      [event("a", at(NOW - HOUR), "someone", at(NOW - 1))],
      undefined,
      "me",
      NOW,
    )
    expect(split.pastAttended.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing).toEqual([])
  })

  it("honours an explicit endsAt that is later than the default duration", () => {
    const split = splitProfileEvents(
      [event("a", at(NOW - 6 * HOUR), "me", at(NOW + HOUR))],
      undefined,
      "me",
      NOW,
    )
    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
  })

  it("counts the exact end instant as ended", () => {
    const split = splitProfileEvents(
      [event("a", at(NOW - HOUR), "me", at(NOW))],
      undefined,
      "me",
      NOW,
    )
    expect(split.pastHosted.map((e) => e.id)).toEqual(["a"])
  })
})

describe("splitProfileEvents modern path ignores the clock entirely", () => {
  it("files a long-ended row the server sent as upcoming under Upcoming", () => {
    const split = splitProfileEvents(
      [],
      [event("a", "2020-01-01T10:00:00.000Z", "me", "2020-01-01T12:00:00.000Z")],
      "me",
      NOW,
    )
    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.pastHosted).toEqual([])
  })

  it("returns four empty buckets for a profile with no events", () => {
    expect(splitProfileEvents([], [], "me", NOW)).toEqual({
      upcomingHosting: [],
      upcomingGoing: [],
      pastHosted: [],
      pastAttended: [],
    })
    expect(splitProfileEvents([], undefined, "me", NOW)).toEqual({
      upcomingHosting: [],
      upcomingGoing: [],
      pastHosted: [],
      pastAttended: [],
    })
  })
})
