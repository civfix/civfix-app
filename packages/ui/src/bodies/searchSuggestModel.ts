/**
 * Pure section-assembly for the RESTING search page (liquid-glass redesign, Task 3): given the raw
 * nearby cleanups, nearby report pins, and follow suggestions, produce the ordered, capped sections
 * the page renders (Suggested people → Events in your area → Reports nearby).
 *
 * Pure + deterministic: the caller passes `now` (never read the clock here) and the resolved viewer
 * location, so the assembly is unit-testable and stable across a render pass. Ranking reuses
 * `eventBlendScore` (the EventsBody "In your area" blend): server `dist` when present, else a
 * haversine fallback from the viewer location; without a location the blend degrades to soonest-first.
 *
 * Gating rules (design):
 *   - Suggested people is AUTH-GATED (the endpoint is too): signed out ⇒ empty section.
 *   - Reports nearby is LOCATION-GATED: proximity is meaningless without a viewer point, so no
 *     location ⇒ empty section (the pins hook returns [] without a point anyway; this makes the
 *     invariant explicit and testable).
 *   - Events render with or without a location (the upcoming list is global; the blend degrades).
 *   - The volunteer leaderboard is NEITHER auth- nor location-gated — it is GEOID-GATED. A signed-OUT
 *     viewer with a device location sees it (`resolveJurisdiction` is auth-optional); a signed-IN
 *     viewer with no location but logged hours sees it (their top jurisdiction). `leaderboard` is
 *     `[]` whenever `leaderboardGeoid` is null, because a board with no jurisdiction to name is a
 *     ranking of nowhere. Resolution itself lives in `bodies/leaderboardGeoid.ts`; this file only
 *     enforces the gate.
 */
import { haversineMeters, type LatLng } from "@civfix/shared"
import { eventBlendScore } from "./eventBlendScore"

export const SUGGESTED_PEOPLE_LIMIT = 8
export const SUGGESTED_EVENTS_LIMIT = 4
export const NEARBY_REPORTS_LIMIT = 4
/**
 * Ranks 1-3 only. This is a PREVIEW of the full board, not a second copy of it. It is a RENDER limit,
 * not the request's `limit` — see {@link LEADERBOARD_REQUEST_LIMIT} for why those had to come apart.
 */
export const LEADERBOARD_PREVIEW_LIMIT = 3

/**
 * What Discovery actually ASKS the leaderboard route for — deliberately larger than the three rows it
 * renders, and NOT tunable downward.
 *
 * The route only computes `viewerRank` / `viewerHours` when the request's `limit` is at least 25
 * (`LEADERBOARD_EXTRAS_MIN_LIMIT` server-side); below that the two keys are absent from the body
 * altogether. Discovery used to send `limit: 3`, which meant the "you rank #58" row it is built to show
 * could never appear — the response it was reading them off of never carried them. The backend is
 * deployed and that threshold is a server fact, so the client asks for exactly the threshold and slices
 * the preview down to {@link LEADERBOARD_PREVIEW_LIMIT} rows itself (`assembleSearchSuggestions` already
 * does that slice). The extra rows cost one page of a route the hook caches for five minutes.
 */
export const LEADERBOARD_REQUEST_LIMIT = 25

/** The minimal event shape the blend needs (CleanupDTO satisfies it). */
export interface SuggestEventLike {
  id: string
  scheduledAt: string
  lat: number
  lng: number
  /** Server-computed meters from the viewer, when the query was location-biased. */
  dist?: number | null
}

export interface SearchSuggestions<C, P, R, L> {
  people: P[]
  events: C[]
  reports: R[]
  leaderboard: L[]
}

export function assembleSearchSuggestions<
  C extends SuggestEventLike,
  P extends { id: string },
  R extends { id: string },
  L,
>({
  cleanups,
  pins,
  people,
  leaderboard,
  leaderboardGeoid,
  location,
  signedIn,
  now,
}: {
  cleanups: readonly C[]
  pins: readonly R[]
  people: readonly P[]
  /** Already rank-ordered by the server; this only caps it. */
  leaderboard: readonly L[]
  /** The resolved jurisdiction, or null when none could be resolved — see the gating note above. */
  leaderboardGeoid: string | null
  location: LatLng | null
  signedIn: boolean
  now: Date
}): SearchSuggestions<C, P, R, L> {
  const events = cleanups
    .map((c) => {
      const meters = location ? (c.dist ?? haversineMeters(location, { lat: c.lat, lng: c.lng })) : null
      return { c, score: eventBlendScore(meters, c.scheduledAt, now) }
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, SUGGESTED_EVENTS_LIMIT)
    .map((x) => x.c)

  return {
    people: signedIn ? people.slice(0, SUGGESTED_PEOPLE_LIMIT) : [],
    events,
    reports: location ? pins.slice(0, NEARBY_REPORTS_LIMIT) : [],
    leaderboard: leaderboardGeoid ? leaderboard.slice(0, LEADERBOARD_PREVIEW_LIMIT) : [],
  }
}
