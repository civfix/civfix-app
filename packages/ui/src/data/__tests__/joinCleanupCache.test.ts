/**
 * Drives the real `joinCleanupMutationOptions` / `claimEventSlotMutationOptions` against a QueryClient
 * rather than re-implementing them, so a regression in the hook wiring fails here. The hooks only add
 * React context (api client, toast, i18n) around these options.
 *
 * The event detail may be cached under `["cleanup", <uuid>]` or under a reference-code key such as
 * `["cleanup", "EVT-2026-0042"]` (the share path is `/cleanups/${referenceCode ?? id}` and the endpoint
 * resolves either), while every mutation is keyed off the UUID. The optimistic flip, the server
 * reconcile and the settle invalidation must all reach a refcode-keyed entry, and a slot claim must
 * write to the rendering key instead of seeding a phantom UUID entry.
 *
 * The mutation var is the CURRENT `joined` (the state before the tap): true means leaving, matching
 * `join.mutate(cleanup.joined)`.
 */
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { CleanupDTO, CleanupAttendeesResponse, JoinCleanupResponse } from "@civfix/shared"
import { queryKeys } from "../keys"
import {
  cleanupDetailFilters,
  joinCleanupMutationOptions,
  claimEventSlotMutationOptions,
  rsvpErrorKey,
} from "../hooks/cleanups"
import { EVENT_ENDED_FIELD, EVENT_ENDED_REASON } from "../errorCode"

const REFCODE = "EVT-2026-0042"

/** A minimal CleanupDTO (only the RSVP/slot-relevant fields matter for these assertions). */
function cleanup(
  id: string,
  joined: boolean,
  going: number,
  extra: Partial<CleanupDTO> = {},
): CleanupDTO {
  return {
    id,
    title: `Cleanup ${id}`,
    type: "site",
    lat: 37.77,
    lng: -122.42,
    scheduledAt: new Date().toISOString(),
    status: "upcoming",
    organizer: { id: "org", name: "Org", isFollowing: false } as CleanupDTO["organizer"],
    going,
    joined,
    bring: [],
    address: null,
    slots: [],
    ...extra,
  } as unknown as CleanupDTO
}

function attendees(going: number): CleanupAttendeesResponse {
  return { attendees: [], going, scope: "following" }
}

/** The MutationFunctionContext react-query (v5.100+) threads into every mutation callback. */
function fnCtx(qc: QueryClient): { client: QueryClient; meta: undefined } {
  return { client: qc, meta: undefined }
}

/** The REAL join options for a target UUID with a stubbed server. */
function joinOptions(qc: QueryClient, id: string, server: () => Promise<JoinCleanupResponse>) {
  return joinCleanupMutationOptions(qc, id, server)
}

describe("cleanup RSVP toggle cache reconciliation (real hook options)", () => {
  it("optimistically joins: flips the detail, every list row, and the roster count", async () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1", false, 4))
    // The "upcoming" events-list / home-feed shared entry holds c1 (going) + c2 (untouched).
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [
      cleanup("c1", false, 4),
      cleanup("c2", false, 9),
    ])
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(4))

    // currentlyJoined=false -> join.
    const opts = joinOptions(qc, "c1", async () => ({ joined: true, going: 5 }))
    const ctx = await opts.onMutate?.(false, fnCtx(qc))

    // Detail flipped + count bumped.
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: true, going: 5 })
    // The c1 row in the list flipped; c2 untouched.
    const list = qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!
    expect(list.find((c) => c.id === "c1")).toMatchObject({ joined: true, going: 5 })
    expect(list.find((c) => c.id === "c2")).toMatchObject({ joined: false, going: 9 })
    // Roster count bumped to match.
    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"))).toMatchObject({
      going: 5,
    })

    // Server confirms -> reconcile (idempotent here).
    opts.onSuccess?.({ joined: true, going: 5 }, false, ctx!, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: true, going: 5 })
  })

  it("rolls the detail, the list row, and the roster count back on error", async () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1", true, 5))
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [cleanup("c1", true, 5)])
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(5))

    // currentlyJoined=true -> leave, but the server fails.
    const opts = joinOptions(qc, "c1", async () => {
      throw new Error("offline")
    })
    const ctx = await opts.onMutate?.(true, fnCtx(qc))
    // Optimistically left (detail + list + roster dropped to 4).
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: false, going: 4 })
    expect(qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))![0]).toMatchObject({
      joined: false,
      going: 4,
    })
    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"))).toMatchObject({
      going: 4,
    })

    // Error -> rollback all three to the pre-tap (joined, going=5).
    opts.onError?.(new Error("offline"), true, ctx!, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: true, going: 5 })
    expect(qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))![0]).toMatchObject({
      joined: true,
      going: 5,
    })
    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"))).toMatchObject({
      going: 5,
    })
  })

  it("REGRESSION: a refcode-opened detail flips, reconciles and invalidates although the mutation is keyed by UUID", async () => {
    const qc = new QueryClient()
    // The page was opened via the share path, so the detail is cached ONLY under the refcode key -
    // there is NO ["cleanup", "c1"] entry. This was the broken configuration: the optimistic patch,
    // the reconcile and the settle invalidation all targeted the UUID key and the page never changed.
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup(REFCODE),
      cleanup("c1", false, 4, { referenceCode: REFCODE } as Partial<CleanupDTO>),
    )
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [cleanup("c1", false, 4)])
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(4))

    const opts = joinOptions(qc, "c1", async () => ({ joined: true, going: 6 }))
    const ctx = await opts.onMutate?.(false, fnCtx(qc))

    // The optimistic flip reached the refcode entry the page renders...
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      joined: true,
      going: 5,
    })
    // ...and mirrored the detail-derived absolute value onto the list row + roster count.
    expect(
      qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!.find((c) => c.id === "c1"),
    ).toMatchObject({ joined: true, going: 5 })
    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"))).toMatchObject({
      going: 5,
    })
    // No phantom UUID entry was seeded (the page renders the refcode key; nothing reads ["cleanup","c1"]).
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toBeUndefined()

    // The server reconcile lands on the refcode entry too (server says 6, not our optimistic 5).
    opts.onSuccess?.({ joined: true, going: 6 }, false, ctx!, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      joined: true,
      going: 6,
    })

    // The settle invalidation marks the refcode entry stale so it refetches (slots etc. reconcile).
    opts.onSettled?.({ joined: true, going: 6 }, null, false, ctx!, fnCtx(qc))
    expect(qc.getQueryState(queryKeys.cleanup(REFCODE))?.isInvalidated).toBe(true)
  })

  it("REGRESSION: rolls a refcode-keyed detail back when the server refuses", async () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup(REFCODE),
      cleanup("c1", false, 4, { referenceCode: REFCODE } as Partial<CleanupDTO>),
    )

    const err = new Error("This event is closed.")
    const opts = joinOptions(qc, "c1", async () => {
      throw err
    })
    const ctx = await opts.onMutate?.(false, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      joined: true,
      going: 5,
    })

    opts.onError?.(err, false, ctx!, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      joined: false,
      going: 4,
    })
  })

  it("keeps BOTH alias entries in sync when the detail is cached under refcode AND UUID", async () => {
    const qc = new QueryClient()
    // Opened once from a share link (refcode) and once from a list (UUID): two live entries.
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup(REFCODE),
      cleanup("c1", false, 4, { referenceCode: REFCODE } as Partial<CleanupDTO>),
    )
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1", false, 4))

    const opts = joinOptions(qc, "c1", async () => ({ joined: true, going: 5 }))
    const ctx = await opts.onMutate?.(false, fnCtx(qc))
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({ joined: true, going: 5 })
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: true, going: 5 })

    opts.onSettled?.({ joined: true, going: 5 }, null, false, ctx!, fnCtx(qc))
    expect(qc.getQueryState(queryKeys.cleanup(REFCODE))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.cleanup("c1"))?.isInvalidated).toBe(true)
  })

  it("RSVPs from a list card with NO cached detail without clobbering the row's going count", async () => {
    const qc = new QueryClient()
    // The DETAIL is deliberately absent: the user tapped RSVP on a list card, having never opened it.
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [
      cleanup("c1", false, 12),
      cleanup("c2", false, 9),
    ])
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(12))

    const opts = joinOptions(qc, "c1", async () => ({ joined: true, going: 13 }))
    const ctx = await opts.onMutate?.(false, fnCtx(qc))

    // The row goes 12 -> 13, NOT 12 -> 1 (the old detail-derived `joined ? 1 : 0` fallback).
    const list = qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!
    expect(list.find((c) => c.id === "c1")).toMatchObject({ joined: true, going: 13 })
    expect(list.find((c) => c.id === "c2")).toMatchObject({ joined: false, going: 9 })
    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"))).toMatchObject({
      going: 13,
    })

    opts.onSuccess?.({ joined: true, going: 13 }, false, ctx!, fnCtx(qc))
    expect(
      qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!.find((c) => c.id === "c1"),
    ).toMatchObject({ joined: true, going: 13 })
  })

  it("leaving from an uncached-detail list card floors the row's going count at 0", async () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [cleanup("c1", true, 0)])

    const opts = joinOptions(qc, "c1", async () => ({ joined: false, going: 0 }))
    await opts.onMutate?.(true, fnCtx(qc))

    expect(qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))![0]).toMatchObject({
      joined: false,
      going: 0,
    })
  })

  it("REGRESSION: leaving invalidates the detail under EVERY alias so a cascaded slot release refetches", async () => {
    const qc = new QueryClient()
    const claimedSlot = {
      id: "s1",
      title: "Check-in table",
      description: null,
      capacity: 12,
      claimed: 5,
      mine: true,
    }
    // Cached under both aliases, with the viewer holding a slot. Leaving releases the slot SERVER-side,
    // but `{joined, going}` reconciliation alone cannot update the embedded `slots` - only the settle
    // refetch can, so both alias entries must come out of settle invalidated.
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup(REFCODE),
      cleanup("c1", true, 5, { referenceCode: REFCODE, slots: [claimedSlot] } as Partial<CleanupDTO>),
    )
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup("c1"),
      cleanup("c1", true, 5, { slots: [claimedSlot] } as Partial<CleanupDTO>),
    )
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(5))

    const opts = joinOptions(qc, "c1", async () => ({ joined: false, going: 4 }))
    const ctx = await opts.onMutate?.(true, fnCtx(qc))
    opts.onSuccess?.({ joined: false, going: 4 }, true, ctx!, fnCtx(qc))
    opts.onSettled?.({ joined: false, going: 4 }, null, true, ctx!, fnCtx(qc))

    expect(qc.getQueryState(queryKeys.cleanup(REFCODE))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.cleanup("c1"))?.isInvalidated).toBe(true)
    // The roster is invalidated too (its viewer scope flips on RSVP).
    expect(qc.getQueryState(queryKeys.cleanupAttendees("c1"))?.isInvalidated).toBe(true)
  })

  it("never patches the attendee roster entry through the detail filters (length-2 keys only)", () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1", false, 4))
    qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees("c1"), attendees(4))

    const matched = qc.getQueriesData<CleanupDTO>(cleanupDetailFilters("c1")).map(([key]) => key)
    expect(matched).toEqual([queryKeys.cleanup("c1")])
  })
})

describe("event slot claim cache reconciliation (real hook options)", () => {
  it("REGRESSION: writes the claim response onto the refcode entry the page renders, not a phantom UUID entry", () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(
      queryKeys.cleanup(REFCODE),
      cleanup("c1", false, 4, { referenceCode: REFCODE } as Partial<CleanupDTO>),
    )
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [cleanup("c1", false, 4)])

    // Claiming auto-RSVPs: the server returns the full refreshed DTO (slots with `mine`, joined, going).
    const res = cleanup("c1", true, 5, {
      referenceCode: REFCODE,
      slots: [{ id: "s1", title: "Truck driver", description: null, capacity: 2, claimed: 1, mine: true }],
    } as Partial<CleanupDTO>)
    const opts = claimEventSlotMutationOptions(qc, "c1", async () => res)
    opts.onSuccess?.(res, { slotId: "s1" }, undefined, fnCtx(qc))

    // The rendering (refcode) entry got the authoritative DTO - joined pill + slot row flip together.
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      joined: true,
      going: 5,
      slots: [{ id: "s1", mine: true }],
    })
    // The old bug: an exact-key `setQueryData(["cleanup","c1"], res)` seeded an entry nothing rendered.
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toBeUndefined()
    // The auto-RSVP is mirrored onto the flat list row (the card behind the sheet).
    expect(
      qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!.find((c) => c.id === "c1"),
    ).toMatchObject({ joined: true, going: 5 })
  })

  it("reconciles a UUID-keyed detail exactly as before", () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1", false, 4))

    const res = cleanup("c1", true, 5)
    const opts = claimEventSlotMutationOptions(qc, "c1", async () => res)
    opts.onSuccess?.(res, { slotId: "s1" }, undefined, fnCtx(qc))

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({ joined: true, going: 5 })
  })
})

describe("rsvpErrorKey (the join/leave failure toast copy)", () => {
  it("maps the server refusals onto the event-rsvp namespace keys", () => {
    expect(rsvpErrorKey("CONFLICT")).toBe("error.closed") // 409 "This event is closed."
    expect(rsvpErrorKey("FORBIDDEN")).toBe("error.not_allowed") // 403 ban / CSRF
    expect(rsvpErrorKey("UNAUTHORIZED")).toBe("error.generic")
    expect(rsvpErrorKey(undefined)).toBe("error.generic") // network failure / non-AppError
  })

  it("tells an ENDED event apart from a closed one by the field the server names", () => {
    expect(rsvpErrorKey("CONFLICT", { [EVENT_ENDED_FIELD]: EVENT_ENDED_REASON })).toBe("error.ended")
    expect(rsvpErrorKey("CONFLICT", {})).toBe("error.closed")
    expect(rsvpErrorKey("CONFLICT", undefined)).toBe("error.closed")
  })
})
