import type { LatLng } from "@civfix/shared/geocode"

export interface ResolvedLocation extends LatLng {
  precise: boolean
}

export function mergeResolvedLocation(
  prev: ResolvedLocation | null,
  next: ResolvedLocation | null,
): ResolvedLocation | null {
  if (!next) return prev
  if (!prev) return next
  if (prev.precise && !next.precise) return prev
  return next
}
