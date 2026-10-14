/**
 * Android's MapLibre view swallows a long press that starts on a MarkerView, but iOS fires
 * `didLongPressMap:` for every press, so a press on a pin would drop a second pin on top of it. This makes
 * iOS behave like Android, in JS.
 *
 * Geometric rather than a real hit test because `MapRef.project` is async on native and the press must be
 * adjudicated synchronously. That is valid only while the map is unrotated and unpitched, which is why
 * both seams disable every rotate and pitch gesture.
 *
 * Fails open: unknown geometry (missing, wrapped or zero-size bbox, non-finite input) accepts the press,
 * because a long press that silently does nothing reads as broken.
 */

/**
 * Derived from the pins: `TeardropPin`/`EventPin` render 38px wide at rest and 50px active in a 64x76
 * viewBox. `tipSlop` exists because fingers land low.
 */
export const MARKER_HIT = {
  halfWidth: 26,
  height: 56,
  tipSlop: 6,
} as const

export type MarkerAnchor = "bottom" | "center"

export interface LongPressMarker {
  lat: number
  lng: number
  anchor?: MarkerAnchor
}

/** Structurally `@civfix/shared`'s BBox, restated so this module imports nothing. */
export interface LongPressBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface LongPressViewportSize {
  width: number
  height: number
}

function finite(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v))
}

export function longPressHitsMarker(
  press: { lat: number; lng: number },
  markers: readonly LongPressMarker[],
  bounds: LongPressBounds | null | undefined,
  size: LongPressViewportSize | null | undefined,
): boolean {
  if (!bounds || !size || markers.length === 0) return false
  if (!finite(press.lat, press.lng, bounds.west, bounds.south, bounds.east, bounds.north, size.width, size.height)) {
    return false
  }
  if (size.width <= 0 || size.height <= 0) return false

  const spanLng = bounds.east - bounds.west
  const spanLat = bounds.north - bounds.south
  // Also rejects an antimeridian-wrapped or flipped bbox, where degPerPx is meaningless.
  if (spanLng <= 0 || spanLat <= 0) return false

  const degPerPxX = spanLng / size.width
  const degPerPxY = spanLat / size.height

  for (const marker of markers) {
    if (!finite(marker.lat, marker.lng)) continue
    const dx = (press.lng - marker.lng) / degPerPxX
    if (Math.abs(dx) > MARKER_HIT.halfWidth) continue
    // Screen Y grows southward while latitude grows northward.
    const dy = (marker.lat - press.lat) / degPerPxY
    if ((marker.anchor ?? "bottom") === "center") {
      if (Math.abs(dy) <= MARKER_HIT.height / 2) return true
    } else if (dy <= MARKER_HIT.tipSlop && dy >= -MARKER_HIT.height) {
      return true
    }
  }
  return false
}
