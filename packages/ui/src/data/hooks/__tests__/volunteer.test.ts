/**
 * Source-shape guards for the service-hours data layer.
 *
 * These are deliberately SOURCE greps rather than render tests: each one locks a decision that is
 * invisible at runtime until it is already wrong in production (a cast that hides a contract drift, an
 * auth gate that silently empties a public surface, a response envelope that does not exist). A render
 * test would need a live query client + a fake API and would still not fail if, say, someone re-added
 * `enabled: isAuthenticated` - it would just render an empty list, exactly as the bug does.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LeaderboardQuerySchema } from "@civfix/shared"
import { leaderboardNextOffset } from "../volunteer"

/**
 * Comments stripped: every guard below is about the CODE. The doc comments in these modules deliberately
 * NAME the mistakes they prevent ("never `res.cleanup`", "the `as unknown as` cast is gone"), so grepping
 * the raw file would fail on the very prose that documents the rule.
 */
function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const volunteerSource = code("../volunteer.ts")
const cleanupsSource = code("../cleanups.ts")
const postsSource = code("../posts.ts")

describe("hooks/volunteer.ts", () => {
  it("has no `as unknown as` cast left - geoid is a real field on LeaderboardQuerySchema now", () => {
    // The cast existed only because `geoid` was missing from the request schema, so the typed client
    // rejected it. With the field in the contract the call site is plainly typed, and a future rename is
    // a compile error here instead of a runtime 422 from the route.
    expect(volunteerSource).not.toContain("as unknown as")
  })

  it("caches the leaderboard: it sits on a primary tab, so default staleTime 0 would refetch on focus", () => {
    expect(volunteerSource).toContain("staleTime: LEADERBOARD_STALE_MS")
    expect(volunteerSource).toContain("gcTime: LEADERBOARD_GC_MS")
  })

  it("threads `limit` into BOTH the cache key and the request", () => {
    expect(volunteerSource).toContain("queryKeys.volunteerLeaderboard(geoid ?? \"unknown\", limit)")
    expect(volunteerSource).toMatch(/api\.getJurisdictionLeaderboard\(\{[\s\S]*?\blimit,/)
  })

  it("leaves the PUBLIC hours query auth-optional (gated on the id alone)", () => {
    // A signed-out visitor must see a public profile's hours; the server decides what is publishable.
    const fn = volunteerSource.slice(
      volunteerSource.indexOf("export function usePublicHoursEntries"),
      volunteerSource.indexOf("export function useEventHours"),
    )
    expect(fn).toContain("enabled: !!userId")
    expect(fn).not.toContain("isAuthenticated")
  })

  it("gates the per-event read-back on auth AND an id (the endpoint requires a session)", () => {
    expect(volunteerSource).toContain("enabled: isAuthenticated && !!cleanupId")
  })

  it("keeps certificates off the ['volunteer'] prefix (presigned URLs must not be persisted)", () => {
    expect(volunteerSource).toContain("queryKey: queryKeys.myCertificates")
  })

  it("clamps deep paging at the offset the endpoint accepts instead of asking for a 422", () => {
    // The response advertises `nextOffset` with no ceiling, but the request schema caps `offset`. At the
    // 50-row page size the 11th page comes back saying "next: 550", which the route rejects outright -
    // so a jurisdiction with >550 ranked volunteers ended its list on a failed request rather than on a
    // clean end-of-list. `undefined` is what stops the infinite query (and clears `hasNextPage`).
    expect(leaderboardNextOffset({ geoid: "0644000", entries: [], nextOffset: 500 })).toBe(500)
    expect(leaderboardNextOffset({ geoid: "0644000", entries: [], nextOffset: 550 })).toBeUndefined()
    expect(leaderboardNextOffset({ geoid: "0644000", entries: [], nextOffset: null })).toBeUndefined()
    expect(leaderboardNextOffset({ geoid: "0644000", entries: [] })).toBeUndefined()
  })

  it("pins that clamp to the request schema's own bound, so the two cannot drift", () => {
    // The bound is duplicated in the hook because the schema does not export it. These two assertions
    // are the tripwire: move `.max(500)` in either direction and this reds instead of the field.
    const bound = Number(/const LEADERBOARD_MAX_OFFSET = (\d+)/.exec(volunteerSource)?.[1])
    expect(Number.isInteger(bound)).toBe(true)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "0644000", offset: bound }).success).toBe(true)
    expect(LeaderboardQuerySchema.safeParse({ geoid: "0644000", offset: bound + 1 }).success).toBe(
      false,
    )
  })

  it("invalidates the event read-back and the itemised ledger after logging hours", () => {
    const fn = volunteerSource.slice(volunteerSource.indexOf("export function useLogEventHours"))
    expect(fn).toContain("queryKeys.eventHours(id)")
    expect(fn).toContain("queryKeys.volunteerEntries")
    expect(fn).toContain("queryKeys.volunteerLeaderboardAll")
  })
})

describe("hooks/cleanups.ts - the bare-alias response rule", () => {
  it("writes the response ITSELF into the detail cache, never `res.cleanup`", () => {
    // GetCleanupResponseSchema is an alias of CleanupDTOSchema, not an envelope. `res.cleanup` is
    // `undefined`, so reading it would blank the event detail body on every claim and every completion.
    // The write goes through the alias-aware reconcile (every key the detail renders under - the page
    // may be cached by refcode), never an exact-key setQueryData that can seed a phantom UUID entry.
    expect(cleanupsSource).not.toMatch(/\bres\.cleanup\b/)
    expect(cleanupsSource).toContain("reconcileCleanupDetails(qc, cleanupId, res)")
    expect(cleanupsSource).not.toContain("qc.setQueryData(queryKeys.cleanup(cleanupId), res)")
  })

  it("exposes ONE slot mutation - claim, switch and release are one idempotent PUT", () => {
    expect(cleanupsSource).toContain("export function useClaimEventSlot")
    expect(cleanupsSource).not.toContain("useReleaseEventSlot")
    expect(cleanupsSource).toContain("slotId: string | null")
  })

  it("claiming a slot patches the LIST rows too - a claim auto-RSVPs, so `joined`/`going` move", () => {
    // The server joins a non-member in the same transaction as the claim (that is what the block's
    // `claim_joins_hint` promises), so every list card for this event is stale the moment the PUT
    // returns. Writing only the detail left the card BEHIND the sheet reading "RSVP" and the old count
    // until that list happened to refetch. This is the same pair `useJoinCleanup` applies.
    // The claim wiring lives in the exported options builder (the hook just injects the api client).
    const fn = cleanupsSource.slice(
      cleanupsSource.indexOf("export function claimEventSlotMutationOptions"),
      cleanupsSource.indexOf("export interface SetMemberRoleVars"),
    )
    expect(fn).toContain(
      "patchCleanupInFlatLists(qc, cleanupId, { joined: res.joined, going: res.going })",
    )
    expect(fn).toContain("queryKey: CLEANUPS_LIST_PREFIX")
    expect(fn).toContain("queryKeys.cleanupAttendees(cleanupId)")
  })

  it("completing an event invalidates the detail (every alias), the list prefix, the ROSTER and the hours read-back", () => {
    // Like the claim above, the completion wiring lives in the exported options builder (the hook just
    // injects the api client) - so the behavioural contract is driven directly against a QueryClient in
    // data/__tests__/complete-cleanup-cache.test.ts and this only pins the shape of the source.
    const fn = cleanupsSource.slice(
      cleanupsSource.indexOf("export function completeCleanupMutationOptions"),
      cleanupsSource.indexOf("export interface ClaimEventSlotVars"),
    )
    expect(fn).toContain("cleanupDetailFilters(id)")
    expect(fn).toContain("CLEANUPS_LIST_PREFIX")
    expect(fn).toContain("queryKeys.eventHours(id)")
    // Completion is what mounts the hours editor, and that editor renders one row per attendee joined
    // from this key - a roster cached before the last RSVPs leaves the host with nobody to credit.
    expect(fn).toContain("queryKeys.cleanupAttendees(id)")
  })
})

describe("hooks/posts.ts", () => {
  it("no longer gates a person's timeline on auth - a signed-out profile must show posts", () => {
    const fn = postsSource.slice(
      postsSource.indexOf("export function useUserPosts"),
      postsSource.indexOf("export function useSaves"),
    )
    expect(fn).toContain("enabled: !!id")
    expect(fn).not.toContain("isAuthenticated")
  })
})
