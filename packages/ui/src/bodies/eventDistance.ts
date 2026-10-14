import { distanceLabel } from "./relativeTime"
import { METERS_PER_MILE } from "./reportHitRowModel"

export function eventDistanceLabel(distMeters: number | null | undefined, locale?: string): string {
  if (distMeters == null || Number.isNaN(distMeters)) return ""
  return distanceLabel(distMeters / METERS_PER_MILE, locale)
}
