/**
 * Rank "In your area" events by a NEAR + SOON blend: a normalized distance term plus a normalized
 * time-until-event term. LOWER score = HIGHER rank. Distance null (no location) zeroes the distance term,
 * degrading to soonest-first. Pure + deterministic: pass `now` in (never read the clock here) so it is
 * unit-testable and stable across a render pass.
 *
 * Constants are tuned so a nearby event next week can outrank a slightly-closer event months out:
 *   DIST_SCALE 8 km  -> every ~8 km of distance costs as much as TIME_SCALE hours of waiting.
 *   TIME_SCALE 72 h  -> three days of lead time costs ~1 distance-unit.
 */
const DIST_SCALE_M = 8_000
const TIME_SCALE_H = 72

export function eventBlendScore(
  distanceMeters: number | null,
  scheduledAt: string,
  now: Date,
): number {
  const distTerm = distanceMeters != null ? distanceMeters / DIST_SCALE_M : 0
  const hoursUntil = (new Date(scheduledAt).getTime() - now.getTime()) / 3_600_000
  // Past-but-still-listed events (clock skew) clamp at 0 so they don't rank ahead of imminent ones.
  const timeTerm = Math.max(0, hoursUntil) / TIME_SCALE_H
  return distTerm + timeTerm
}
