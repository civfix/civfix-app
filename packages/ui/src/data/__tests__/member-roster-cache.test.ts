/**
 * Unit test for the WS4 member-removal roster reconciliation. `useRemoveMember` patches the cached
 * attendee roster on success with {@link rosterWithoutMember}: the removed row drops out immediately
 * and the server's authoritative `going` is adopted, so the MembersBody list and every going-counter
 * update without waiting for the invalidation refetch. Driven here against a real QueryClient (the
 * data/__tests__ house pattern: pure cache logic, no renderer).
 */
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { AttendeeDTO, CleanupAttendeesResponse } from "@civfix/shared"
import { rosterWithoutMember } from "../hooks/cleanups"
import { queryKeys } from "../keys"

function attendee(id: string, role: AttendeeDTO["role"]): AttendeeDTO {
  return { id, name: `Person ${id}`, isFollowing: false, role } as unknown as AttendeeDTO
}

function roster(): CleanupAttendeesResponse {
  return {
    attendees: [attendee("org", "organizer"), attendee("co", "cohost"), attendee("m1", "member")],
    going: 3,
    scope: "all",
  } as CleanupAttendeesResponse
}

describe("rosterWithoutMember", () => {
  it("drops the removed row and adopts the server going count", () => {
    const next = rosterWithoutMember(roster(), "m1", 2)
    expect(next?.attendees.map((a) => a.id)).toEqual(["org", "co"])
    expect(next?.going).toBe(2)
  })

  it("is a no-op passthrough for an uncached roster", () => {
    expect(rosterWithoutMember(undefined, "m1", 2)).toBeUndefined()
  })

  it("leaves other rows (and their roles) untouched when the target is not present", () => {
    const next = rosterWithoutMember(roster(), "ghost", 3)
    expect(next?.attendees.map((a) => a.id)).toEqual(["org", "co", "m1"])
    expect(next?.attendees.map((a) => a.role)).toEqual(["organizer", "cohost", "member"])
  })

  it("applies cleanly through QueryClient.setQueryData the way the hook does", () => {
    const qc = new QueryClient()
    const id = "c1"
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id), roster())

    // Mirror useRemoveMember's onSuccess cache write.
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id), (prev) =>
      rosterWithoutMember(prev, "co", 2),
    )

    const cached = qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id))
    expect(cached?.attendees.map((a) => a.id)).toEqual(["org", "m1"])
    expect(cached?.going).toBe(2)
  })
})
