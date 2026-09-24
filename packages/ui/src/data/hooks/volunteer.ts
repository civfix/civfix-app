/**
 * Shared React Query hooks for the volunteer service-hours ledger - the aggregate, the itemised
 * transcript (own + public), the per-event read-back, the jurisdiction leaderboard, and the issued PDF
 * certificates. Framework-light: they reach the host API client + auth state through the injected data
 * context (useApi / useAuthState) and use the SHARED queryKeys. No expo / next / store imports.
 *
 *   useMyHours()                        - GET /me/volunteer-hours: the viewer's total + by-jurisdiction.
 *   useMyHoursEntries()                 - GET /me/volunteer-hours/entries: the viewer's own itemised
 *                                         ledger, cursor-infinite. Auth-gated.
 *   usePublicHoursEntries(userId)       - GET /people/:id/volunteer-hours: someone else's PUBLIC hours,
 *                                         cursor-infinite. Auth-OPTIONAL - a signed-out visitor reads it,
 *                                         and the server reports `visible: false` honestly when the owner
 *                                         has opted out. Never gate this on `isAuthenticated`.
 *   useEventHours(cleanupId)            - GET /cleanups/:id/hours: what has already been logged for one
 *                                         event (host scope "all" / attendee scope "self"). Auth-gated.
 *   useJurisdictionLeaderboard(geoid)   - GET /jurisdictions/:geoid/leaderboard, offset-infinite.
 *   useLogEventHours()                  - POST /cleanups/:id/hours: per-attendee credit (host action).
 *   useMyServiceHoursCertificates()     - GET /me/volunteer-hours/certificates.
 *   useIssueServiceHoursCertificate()   - POST /me/volunteer-hours/certificates (mint or reuse).
 *   useRevokeServiceHoursCertificate()  - POST /me/volunteer-hours/certificates/:code/revoke.
 *
 * KEY HYGIENE: every key here comes from the canonical `queryKeys` factory, so a mutation's invalidation
 * and a read surface's key cannot drift apart. The certificate list is the ONE deliberate exception to the
 * `["volunteer"]` prefix and must stay off it, so volunteer invalidations do not refetch the certificate
 * list.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  EventHoursEntry,
  EventHoursResponse,
  GetMyHoursResponse,
  IssueServiceHoursCertificateRequest,
  IssueServiceHoursCertificateResponse,
  LeaderboardResponse,
  ListMyCertificatesResponse,
  LogEventHoursResponse,
  MyVolunteerHoursEntriesResponse,
  PublicVolunteerHoursResponse,
  RevokeCertificateRequest,
  RevokeCertificateResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { coercePages } from "../infinitePages"
import { queryKeys } from "../keys"
import { cleanupDetailFilters } from "./cleanups"

export const LEADERBOARD_PAGE_SIZE = 50

/**
 * The leaderboard is a slow-moving aggregate (hours are credited after an event ends, not continuously),
 * so it is cached HARD: fresh for five minutes, retained for thirty. Without these it inherits React
 * Query's `staleTime: 0`, and since the board sits on a PRIMARY tab (Discovery) rather than its own
 * body, every tab switch and every window focus would re-hit a route that computes a ranking.
 */
const LEADERBOARD_STALE_MS = 5 * 60_000
const LEADERBOARD_GC_MS = 30 * 60_000

/**
 * The deepest `offset` the endpoint ACCEPTS: `LeaderboardQuerySchema.offset` is `.max(500)`, and the
 * route parses that schema strictly, so an offset past it is a 422 rather than an empty page.
 *
 * The response's `nextOffset` is computed with no such ceiling, so at a 50-row page size page 11 comes
 * back advertising `nextOffset: 550`; handing that straight back to the query would turn "end of a very
 * long board" into a failed request. The clamp below makes the last accepted page the last page, which
 * is what `hasNextPage` (and therefore LeaderboardBody's `onEndReached`) then reports.
 *
 * The number is duplicated rather than imported because the schema does not export its bound; the unit
 * test asserts it against `LeaderboardQuerySchema` itself so the two cannot drift.
 */
const LEADERBOARD_MAX_OFFSET = 500

/**
 * The infinite query's `getNextPageParam`, lifted out so it is unit-testable without a query client.
 * `undefined` = end of list. Exported for that test only; it is NOT re-exported from `src/data`.
 */
export function leaderboardNextOffset(lastPage: LeaderboardResponse): number | undefined {
  const next = lastPage.nextOffset
  return typeof next === "number" && next <= LEADERBOARD_MAX_OFFSET ? next : undefined
}

/**
 * The infinite query's `select` (drop any null row the route may have emitted), at MODULE scope so its
 * identity is stable: React Query re-runs `select` whenever its identity changes, and an inline arrow
 * would hand Discovery a fresh pages array on every render, invalidating its `sections` useMemo on a
 * surface that stays resident for the session.
 */
const selectLeaderboardPages = coercePages<LeaderboardResponse>("entries")

export function useMyHours() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<GetMyHoursResponse>({
    queryKey: queryKeys.volunteerMe,
    enabled: isAuthenticated,
    queryFn: () => api.getMyHours(),
    retry: false,
  })
}

/** Options for {@link useJurisdictionLeaderboard}. `limit` is part of the cache key, not just the request. */
export interface JurisdictionLeaderboardOptions {
  /** Rows per page. The full board asks for {@link LEADERBOARD_PAGE_SIZE}; a preview asks for a handful. */
  limit?: number
}

/**
 * GET /jurisdictions/:geoid/leaderboard - the ranked volunteers of one jurisdiction, offset-infinite.
 * Auth-OPTIONAL (a signed-out visitor sees the board; only `viewerRank`/`viewerHours` need a session).
 *
 * `geoid` is a field of `LeaderboardQuerySchema`, so the client extracts it as the `:geoid` path param and
 * keeps it out of the query string; the call site stays plainly typed, so a future rename of the field is
 * a type error here rather than a runtime 422.
 */
export function useJurisdictionLeaderboard(
  geoid?: string,
  { limit = LEADERBOARD_PAGE_SIZE }: JurisdictionLeaderboardOptions = {},
) {
  const api = useApi()
  return useInfiniteQuery<LeaderboardResponse>({
    queryKey: queryKeys.volunteerLeaderboard(geoid ?? "unknown", limit),
    enabled: !!geoid,
    initialPageParam: 0 as number,
    queryFn: ({ pageParam }) =>
      api.getJurisdictionLeaderboard({
        geoid: geoid as string,
        limit,
        offset: typeof pageParam === "number" ? pageParam : 0,
      }),
    getNextPageParam: leaderboardNextOffset,
    retry: false,
    staleTime: LEADERBOARD_STALE_MS,
    gcTime: LEADERBOARD_GC_MS,
    select: selectLeaderboardPages,
  })
}

/**
 * GET /me/volunteer-hours/entries - the viewer's OWN itemised ledger (every source: event, report,
 * manual), keyset-paginated newest-credit-first. Auth-gated: there is no anonymous projection of it.
 */
export function useMyHoursEntries() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<MyVolunteerHoursEntriesResponse>({
    queryKey: queryKeys.volunteerEntries,
    enabled: isAuthenticated,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getMyHoursEntries({ ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

/**
 * GET /people/:id/volunteer-hours - another person's PUBLIC hours (event rows only; report awards are
 * aggregated into `reportHours`), keyset-paginated.
 *
 * Auth-OPTIONAL by design, so this gates on the id ALONE - deliberately NOT on `isAuthenticated`. A
 * signed-out visitor landing on a public profile must see the hours section; the server decides what is
 * publishable and reports `visible: false` when the owner has the privacy toggle off.
 */
export function usePublicHoursEntries(userId?: string) {
  const api = useApi()
  return useInfiniteQuery<PublicVolunteerHoursResponse>({
    queryKey: queryKeys.volunteerUserEntries(userId ?? "unknown"),
    enabled: !!userId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getPublicVolunteerHours({
        id: userId as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

/**
 * GET /cleanups/:id/hours - the read-back of what has ALREADY been credited for one event. A host gets
 * `scope: "all"` (every attendee row, so the log form prefills instead of double-crediting); anyone else
 * gets `scope: "self"` - at most their own row, plus `anyLogged`, which is what lets the attendee receipt
 * tell "the host has not logged yet" apart from "the host logged and did not credit me".
 *
 * Auth-gated AND id-gated: the endpoint requires a session, so a signed-out render must not fire it.
 */
export function useEventHours(cleanupId?: string) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<EventHoursResponse>({
    queryKey: queryKeys.eventHours(cleanupId ?? "unknown"),
    enabled: isAuthenticated && !!cleanupId,
    queryFn: () => api.getEventHours({ id: cleanupId as string }),
    retry: false,
  })
}

/** The mutation variable for useLogEventHours: the cleanup id + the PER-ATTENDEE `entries`. */
export interface LogEventHoursVars {
  id: string
  entries: EventHoursEntry[]
}

/**
 * POST /cleanups/:id/hours - the host credits each listed attendee individually. On success every
 * surface the new credit changes is invalidated: the viewer's own aggregate + itemised ledger, every
 * leaderboard variant, the event detail, THIS event's hours read-back (which is what flips an
 * attendee's receipt from "pending" to "credited" and prefills the host's own editor on re-open),
 * this event's host insights, the hosted-events root (portfolio lists + analytics, which carry
 * `hoursCredited` / `totalHours` / `topVolunteers`) and every org page (whose `volunteerHours` /
 * `volunteerCount` are sums over exactly these rows).
 */
export function useLogEventHours() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<LogEventHoursResponse, unknown, LogEventHoursVars>({
    mutationFn: ({ id, entries }) => api.logEventHours({ id, entries }),
    onSuccess: (_res, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.volunteerMe })
      void qc.invalidateQueries({ queryKey: queryKeys.volunteerEntries })
      void qc.invalidateQueries({ queryKey: queryKeys.volunteerLeaderboardAll })
      // Every alias key the event detail may render under (UUID + refcode) - see cleanupDetailFilters.
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: queryKeys.eventHours(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.hostedEventsRoot })
      void qc.invalidateQueries({ queryKey: queryKeys.orgRoot })
    },
  })
}

/**
 * GET /me/volunteer-hours/certificates - the viewer's issued service-hours documents.
 *
 * Each row carries a PRESIGNED `url` that expires in minutes, which is why this query is keyed off the
 * `["volunteer"]` prefix entirely and why a stale entry is refetched rather than trusted: an expired
 * link must be re-minted, not replayed.
 */
export function useMyServiceHoursCertificates() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ListMyCertificatesResponse>({
    queryKey: queryKeys.myCertificates,
    enabled: isAuthenticated,
    queryFn: () => api.listMyServiceHoursCertificates(),
    retry: false,
  })
}

/**
 * POST /me/volunteer-hours/certificates - mint (or reuse) the viewer's transcript PDF over their WHOLE
 * verified ledger. The server is idempotent on a fingerprint of the included rows, so pressing this again
 * with an unchanged ledger returns the SAME document with a fresh presigned link (`reused: true`) rather
 * than rendering a second one. `locale` stamps the document's language.
 *
 * On success the certificate list is invalidated so the freshly-minted (or re-linked) row lands in it.
 */
export function useIssueServiceHoursCertificate() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    IssueServiceHoursCertificateResponse,
    unknown,
    IssueServiceHoursCertificateRequest
  >({
    mutationFn: (input) => api.issueServiceHoursCertificate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.myCertificates })
    },
  })
}

/**
 * POST /me/volunteer-hours/certificates/:code/revoke - the holder invalidates a document they handed out.
 * Revocation is the ONLY control over an already-shared code (the printed code is the capability), so this
 * is deliberately a first-class action rather than a hidden one. `code` travels in the body AND fills the
 * path param - the client's path-param extraction only auto-fires for `:id`.
 */
export function useRevokeServiceHoursCertificate() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RevokeCertificateResponse, unknown, RevokeCertificateRequest>({
    mutationFn: ({ code }) => api.revokeServiceHoursCertificate({ code }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.myCertificates })
    },
  })
}
