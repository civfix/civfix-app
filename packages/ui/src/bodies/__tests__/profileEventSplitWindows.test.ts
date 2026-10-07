import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { splitProfileEvents } from "../profile/profileEventSplit"

function event(
  id: string,
  scheduledAt: string,
  organizerId: string,
  endsAt?: string | null,
): CleanupDTO {
  return { id, scheduledAt, endsAt, organizer: { id: organizerId } } as unknown as CleanupDTO
}

describe("splitProfileEvents ignores the clock entirely", () => {
  it("files a long-ended row the server sent as upcoming under Upcoming", () => {
    const split = splitProfileEvents(
      [],
      [event("a", "2020-01-01T10:00:00.000Z", "me", "2020-01-01T12:00:00.000Z")],
      "me",
    )
    expect(split.upcomingHosting.map((e) => e.id)).toEqual(["a"])
    expect(split.pastHosted).toEqual([])
  })

  it("files a far-future row the server sent as past under Past", () => {
    const split = splitProfileEvents([event("a", "2099-01-01T10:00:00.000Z", "someone")], undefined, "me")
    expect(split.pastAttended.map((e) => e.id)).toEqual(["a"])
    expect(split.upcomingGoing).toEqual([])
  })

  it("returns four empty buckets for a profile with no events", () => {
    const empty = { upcomingHosting: [], upcomingGoing: [], pastHosted: [], pastAttended: [] }
    expect(splitProfileEvents([], [], "me")).toEqual(empty)
    expect(splitProfileEvents([], undefined, "me")).toEqual(empty)
  })
})
