/**
 * Unit tests for the host-completion cache reconciliation, driven against the REAL
 * `completeCleanupMutationOptions` the hook spreads into `useMutation` (never a hand-rebuilt copy - the
 * sibling RSVP suite documents how re-implementing the options stayed green through real bugs).
 *
 * WHAT THESE PIN. Marking an event complete is what mounts the volunteer-hours surface, so this one
 * mutation has to leave four things consistent at once:
 *
 *   1. the detail flips to 'done' - the ONLY gate that mounts `EventHoursBlock` is
 *      `cleanup.status === "done"` in EventDetailBody's lifecycle switch;
 *   2. it flips under a REFCODE alias key too (share-link opens cache at `["cleanup","EVT-…"]` while the
 *      mutation is keyed off the UUID - see cleanupDetailFilters);
 *   3. the viewer-scoped fields survive, because `actsAsHost` is derived from `myRole` and it is what
 *      chooses the host EDITOR over an attendee receipt;
 *   4. the ATTENDEE ROSTER is invalidated - the host editor renders one row per attendee, so a roster
 *      cached before the last RSVPs leaves the host with nothing (or too little) to credit until they
 *      leave the screen and come back. This is the regression that prompted the suite.
 */
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { CleanupDTO } from "@civfix/shared"
import { queryKeys } from "../keys"
import { completeCleanupMutationOptions } from "../hooks/cleanups"

const UUID = "11111111-1111-1111-1111-111111111111"
const REFCODE = "EVT-2026-0042"

function cleanup(extra: Partial<CleanupDTO> = {}): CleanupDTO {
  return {
    id: UUID,
    title: "Beach cleanup",
    type: "site",
    lat: 37.77,
    lng: -122.42,
    scheduledAt: new Date(Date.now() - 3_600_000).toISOString(),
    status: "upcoming",
    organizer: { id: "org", name: "Org", isFollowing: false },
    going: 3,
    joined: true,
    myRole: "organizer",
    bring: [],
    address: null,
    slots: [],
    ...extra,
  } as unknown as CleanupDTO
}

/** The server's completion response: the same event, now done, still viewer-scoped to the host. */
const completed = cleanup({ status: "done" })

/** Drive the real options' onSuccess exactly as useMutation would. */
function runOnSuccess(qc: QueryClient, res: CleanupDTO = completed) {
  const options = completeCleanupMutationOptions(qc, async () => res)
  options.onSuccess?.(res, { id: UUID }, undefined, undefined as never)
}

/** Record which keys were invalidated, since invalidation leaves no value behind to assert on. */
function trackInvalidations(qc: QueryClient): string[][] {
  const seen: string[][] = []
  const original = qc.invalidateQueries.bind(qc)
  qc.invalidateQueries = ((filters?: { queryKey?: unknown }) => {
    if (filters && Array.isArray(filters.queryKey)) seen.push(filters.queryKey as string[])
    return original(filters as never)
  }) as typeof qc.invalidateQueries
  return seen
}

describe("completeCleanupMutationOptions", () => {
  it("flips the UUID-keyed detail to done so the hours block mounts", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup())
    runOnSuccess(qc)
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))?.status).toBe("done")
  })

  it("flips a refcode-aliased detail (share-link opens) to done as well", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(REFCODE), cleanup())
    runOnSuccess(qc)
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))?.status).toBe("done")
  })

  it("keeps myRole/joined, so the host still gets the editor and not an attendee receipt", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup())
    runOnSuccess(qc)
    const after = qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))
    expect(after?.myRole).toBe("organizer")
    expect(after?.joined).toBe(true)
  })

  it("invalidates the attendee roster - the hours editor renders one row per attendee", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup())
    const invalidated = trackInvalidations(qc)
    runOnSuccess(qc)
    expect(invalidated).toContainEqual(queryKeys.cleanupAttendees(UUID))
  })

  it("invalidates this event's hours read-back and the list prefix", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup())
    const invalidated = trackInvalidations(qc)
    runOnSuccess(qc)
    expect(invalidated).toContainEqual(queryKeys.eventHours(UUID))
    expect(invalidated).toContainEqual(["cleanups"])
  })
})
