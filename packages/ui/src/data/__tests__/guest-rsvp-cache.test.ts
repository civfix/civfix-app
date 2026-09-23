import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { CleanupDTO, CleanupAttendeesResponse, GuestRsvpVerifyResponse } from "@civfix/shared"
import { queryKeys } from "../keys"
import { applyGuestRsvpToCaches, guestRsvpVerifyMutationOptions } from "../hooks/cleanups"

const UUID = "11111111-2222-3333-4444-555555555555"
const REFCODE = "EVT-2026-0042"

function cleanup(id: string, going: number, extra: Partial<CleanupDTO> = {}): CleanupDTO {
  return {
    id,
    title: `Cleanup ${id}`,
    type: "site",
    lat: 37.77,
    lng: -122.42,
    scheduledAt: new Date().toISOString(),
    status: "upcoming",
    organizer: { id: "org", name: "Org", isFollowing: false },
    going,
    joined: false,
    bring: [],
    address: null,
    slots: [],
    linkedReports: [],
    ...extra,
  } as unknown as CleanupDTO
}

function attendees(going: number): CleanupAttendeesResponse {
  return { attendees: [], going, scope: "following" }
}

function fnCtx(qc: QueryClient): { client: QueryClient; meta: undefined } {
  return { client: qc, meta: undefined }
}

const VERIFIED: GuestRsvpVerifyResponse = {
  joined: true,
  going: 5,
  manageToken: "a".repeat(32),
  ticketTokens: [],
}

const VARS = { channel: "email", email: "ada@example.com", code: "123456" } as const

function runOnSuccess(qc: QueryClient, id: string, res: GuestRsvpVerifyResponse = VERIFIED) {
  const options = guestRsvpVerifyMutationOptions(qc, id, async () => res)
  options.onSuccess?.(res, { ...VARS }, undefined, fnCtx(qc))
}

function trackInvalidations(qc: QueryClient): string[][] {
  const seen: string[][] = []
  const original = qc.invalidateQueries.bind(qc)
  qc.invalidateQueries = ((filters?: { queryKey?: unknown }) => {
    if (filters && Array.isArray(filters.queryKey)) seen.push(filters.queryKey as string[])
    return original(filters as never)
  }) as typeof qc.invalidateQueries
  return seen
}

describe("applyGuestRsvpToCaches", () => {
  it("adopts the server going on the detail and bumps guestCount", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup(UUID, 4, { guestCount: 1 }))

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))).toMatchObject({
      going: 5,
      guestCount: 2,
    })
  })

  it("leaves guestCount ABSENT when the payload never carried it", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup(UUID, 4))

    applyGuestRsvpToCaches(qc, UUID, 5)

    const detail = qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))!
    expect(detail.going).toBe(5)
    expect(detail.guestCount).toBeUndefined()
  })

  it("does NOT flip joined - the signed-out viewer joined nothing", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup(UUID, 4))
    qc.setQueryData(queryKeys.cleanups("upcoming", 50), [cleanup(UUID, 4)])

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))).toMatchObject({ joined: false })
    const list = qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!
    expect(list[0]).toMatchObject({ joined: false, going: 5 })
  })

  it("patches EVERY flat list under the cleanups prefix and no other event's row", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanups("upcoming", 50), [
      cleanup(UUID, 4, { guestCount: 1 }),
      cleanup("other", 9, { guestCount: 3 }),
    ])
    qc.setQueryData(queryKeys.cleanupsNearby("upcoming", 8, 37.77, -122.42), [
      cleanup(UUID, 4, { guestCount: 1 }),
    ])

    applyGuestRsvpToCaches(qc, UUID, 5)

    const list = qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!
    expect(list.find((c) => c.id === UUID)).toMatchObject({ going: 5, guestCount: 2 })
    expect(list.find((c) => c.id === "other")).toMatchObject({ going: 9, guestCount: 3 })
    const nearby = qc.getQueryData<CleanupDTO[]>(
      queryKeys.cleanupsNearby("upcoming", 8, 37.77, -122.42),
    )!
    expect(nearby[0]).toMatchObject({ going: 5, guestCount: 2 })
  })

  it("nudges the attendee roster count without touching its rows", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanupAttendees(UUID), attendees(4))

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(UUID))).toEqual({
      attendees: [],
      going: 5,
      scope: "following",
    })
  })

  it("reaches a detail cached under its REFERENCE CODE, not just the uuid key", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(REFCODE), cleanup(UUID, 4, { guestCount: 0 }))

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({
      going: 5,
      guestCount: 1,
    })
  })

  it("patches BOTH alias entries when the event is cached under uuid and refcode at once", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup(UUID, 4))
    qc.setQueryData(queryKeys.cleanup(REFCODE), cleanup(UUID, 4))

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))).toMatchObject({ going: 5 })
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(REFCODE))).toMatchObject({ going: 5 })
  })

  it("seeds nothing for an event no surface has cached", () => {
    const qc = new QueryClient()

    applyGuestRsvpToCaches(qc, UUID, 5)

    expect(qc.getQueryData(queryKeys.cleanup(UUID))).toBeUndefined()
    expect(qc.getQueryData(queryKeys.cleanupAttendees(UUID))).toBeUndefined()
  })
})

describe("guestRsvpVerifyMutationOptions", () => {
  it("applies the server going on success", () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(UUID), cleanup(UUID, 4, { guestCount: 0 }))

    runOnSuccess(qc, UUID)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(UUID))).toMatchObject({
      going: 5,
      guestCount: 1,
      joined: false,
    })
  })

  it("invalidates the list prefix and the roster", () => {
    const qc = new QueryClient()
    const invalidated = trackInvalidations(qc)

    runOnSuccess(qc, UUID)

    expect(invalidated).toContainEqual(["cleanups"])
    expect(invalidated).toContainEqual(queryKeys.cleanupAttendees(UUID))
  })

  it("invalidates the detail through the alias filters, so a refcode entry refetches too", async () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.cleanup(REFCODE), cleanup(UUID, 4))

    runOnSuccess(qc, UUID)

    expect(qc.getQueryState(queryKeys.cleanup(REFCODE))?.isInvalidated).toBe(true)
  })
})

describe("profile-events cache keys", () => {
  it("anchors the profile events page on the cursor it continues from", () => {
    expect(queryKeys.profileEvents("me", "cur1")).toEqual(["profile", "me", "events", "cur1"])
    expect(queryKeys.profileEvents("me", null)).toEqual(["profile", "me", "events", null])
  })
})
