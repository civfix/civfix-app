/**
 * The ONE geoid resolver in the package: which jurisdiction's leaderboard does a surface show?
 *
 * Precedence is device location FIRST, the viewer's own hours second:
 *
 *   1. `resolved` - `useResolveJurisdiction(lat, lng)`, which is auth-OPTIONAL, so the discovery
 *      leaderboard works signed OUT. That is the whole point: a jurisdiction leaderboard is a
 *      "here is your city" surface, not a personal one.
 *   2. the first `byJurisdiction` entry of the viewer's own hours (signed in only) - server-sorted
 *      highest-first, so this is the community the viewer actually serves.
 *   3. `null` - the section is hidden. Never guess.
 *
 * This replaces the hard-coded `myHours.byJurisdiction[0]` reads that used to sit inline in the
 * profile and social bodies, which also silently assumed index 0 exists under
 * `noUncheckedIndexedAccess`.
 */

export interface DiscoveryGeoid {
  geoid: string
  name: string | null
  source: "location" | "my-hours"
}

export function resolveDiscoveryGeoid(input: {
  /** From `useResolveJurisdiction`: `undefined` while loading, `null` for an uncovered point. */
  resolved?: { geoid: string; name?: string | null } | null
  /** From `useMyHours`: absent when signed out or still loading. */
  myHours?: { byJurisdiction: ReadonlyArray<{ geoid: string; name?: string | null }> } | null
}): DiscoveryGeoid | null {
  const resolved = input.resolved
  if (resolved && resolved.geoid) {
    return { geoid: resolved.geoid, name: resolved.name ?? null, source: "location" }
  }
  const mine = input.myHours?.byJurisdiction?.[0]
  if (mine && mine.geoid) {
    return { geoid: mine.geoid, name: mine.name ?? null, source: "my-hours" }
  }
  return null
}
