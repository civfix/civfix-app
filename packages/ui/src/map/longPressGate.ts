/**
 * "Did this long press land on an existing marker?" - the cross-platform normaliser for the map
 * long-press -> drop-pin gesture.
 *
 * WHY THIS EXISTS. The two native platforms disagree, and neither is configurable:
 *   - ANDROID's MapLibre view performs a marker hit test first and SWALLOWS a long press that starts
 *     inside a MarkerView, so `onLongPress` never fires over a pin.
 *   - iOS has no such hit test: `didLongPressMap:` fires for every long press, including one directly
 *     on top of a report/event pin.
 * Left alone, a long press on a pin would drop a second, coral "create here" pin on top of the pin the
 * user was clearly aiming at on iOS and do nothing on Android. This module makes iOS behave like
 * Android, in JS, so the decision is explicit and testable rather than an accident of the platform.
 *
 * WHY IT IS GEOMETRIC, NOT A REAL HIT TEST. Projecting each marker to screen space is ASYNC on the
 * native seam (`MapRef.project` returns a Promise), and a long press must be adjudicated synchronously
 * inside the event handler. The map publishes its settled bounds (`useMapViewport`) and the seam knows
 * its own laid-out pixel size, and that is enough: an axis-aligned map has a constant degrees-per-pixel
 * on each axis, so the pressed coordinate and every marker coordinate convert to screen offsets with
 * two divisions.
 *
 * KNOWN GAP - A ROTATED MAP. The `degPerPx` derivation is valid only while the map is UNROTATED. Neither
 * seam disables rotation today: `Map.web.tsx` turns off `dragRotate` and `pitchWithRotate` but leaves
 * two-finger `touchZoomRotate` on, and `Map.native.tsx` passes no rotate/pitch props at all (the library
 * defaults them ON). While the user holds a rotated bearing, the bbox is the AXIS-ALIGNED envelope of a
 * rotated viewport, so degPerPx is overstated and the hit box shrinks in screen terms. The consequence is
 * bounded and one-directional: iOS marker suppression gets less sensitive (a press near a pin's edge may
 * drop a pin) - it never suppresses a press that should have been accepted, and Android is unaffected
 * because its own native hit test still runs first.
 *
 * FAILS OPEN. A missing / zero-width / wrapped (antimeridian) bbox, a zero-size viewport, or any
 * non-finite input returns FALSE - "no marker was hit" - so the long press is ACCEPTED. Refusing to drop
 * a pin because the geometry was momentarily unknown is the worse failure: the gesture would silently do
 * nothing and read as broken.
 *
 * Pure - no react-native / maplibre / next - so it unit-tests directly and both seams may import it.
 */

/**
 * The screen-space box, in px, a marker is treated as occupying around its anchor coordinate.
 *
 * Derived from the pins themselves: `TeardropPin`/`EventPin` render 38px wide at rest and 50px when
 * active, in a 64x76 viewBox (so ~45px and ~59px tall). `halfWidth` covers the widest pin plus a touch
 * pad; `height` is the teardrop body a "bottom"-anchored pin extends UPWARD from its tip; `tipSlop`
 * is the small margin BELOW a tip that still counts as the pin (fingers land low).
 */
export const MARKER_HIT = {
  /** Half the hit box's width (50px active pin / 2, plus a small touch pad). */
  halfWidth: 26,
  /** Full hit-box height. For "bottom" anchors this is measured UP from the tip; for "center", split. */
  height: 56,
  /** Extra tolerance below a "bottom"-anchored tip. */
  tipSlop: 6,
} as const

/** How a marker's graphic is positioned relative to its coordinate (mirrors maplibre's `anchor`). */
export type MarkerAnchor = "bottom" | "center"

/** The minimum a marker must expose to be hit-tested. */
export interface LongPressMarker {
  lat: number
  lng: number
  /** Defaults to "bottom" - every teardrop pin plants its TIP on the coordinate. */
  anchor?: MarkerAnchor
}

/** The map's settled bounds (structurally `@civfix/shared`'s BBox, restated so this module imports nothing). */
export interface LongPressBounds {
  west: number
  south: number
  east: number
  north: number
}

/** The map view's laid-out pixel size. */
export interface LongPressViewportSize {
  width: number
  height: number
}

function finite(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v))
}

/**
 * True when the pressed coordinate lands inside any marker's screen-space hit box - i.e. the seam should
 * SWALLOW this long press. False means "accepted, drop a pin"; see the fail-open note in the header.
 */
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
  // <= 0 covers BOTH the degenerate zero-width/height viewport and a WRAPPED bbox (east < west across
  // the antimeridian, or a flipped north/south) - in every one of those cases degPerPx is meaningless.
  if (spanLng <= 0 || spanLat <= 0) return false

  const degPerPxX = spanLng / size.width
  const degPerPxY = spanLat / size.height

  for (const marker of markers) {
    if (!finite(marker.lat, marker.lng)) continue
    // px RIGHT of the marker's anchor.
    const dx = (press.lng - marker.lng) / degPerPxX
    if (Math.abs(dx) > MARKER_HIT.halfWidth) continue
    // px BELOW the marker's anchor (screen Y grows southward, latitude grows northward).
    const dy = (marker.lat - press.lat) / degPerPxY
    if ((marker.anchor ?? "bottom") === "center") {
      if (Math.abs(dy) <= MARKER_HIT.height / 2) return true
    } else if (dy <= MARKER_HIT.tipSlop && dy >= -MARKER_HIT.height) {
      // A "bottom"-anchored teardrop plants its TIP on the coordinate and rises from there, so the box
      // is asymmetric: the whole body is NORTH of (above) the coordinate.
      return true
    }
  }
  return false
}
