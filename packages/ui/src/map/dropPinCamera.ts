/**
 * The drop-pin surface overlays the live map, so flying straight to the pressed point would centre it
 * under the surface. The camera centre is pushed away by the distance between the window's centre and
 * the visible strip's centre: vertically in compact (sheet below, notch or web banner above via
 * `topInset`), horizontally in expanded (rail and card float over the left edge of the full-bleed map).
 *
 * `topInset` matters because `sheetSnapPoints` clamps `full` to `windowHeight - topReserve`, so without it
 * the FULL-detent pin lands under the Dynamic Island. The offset is half the unoccluded band and can be
 * negative when the top occluder is taller than the sheet.
 *
 * Mercator math at the 512-px tile convention shared by maplibre-gl and MapLibre-native. Longitude is
 * linear in Mercator X, so the horizontal shift is a plain degree subtraction.
 *
 * The host owns the camera: it feeds this target into its own flyTo, and only when `openDropPinMenu`
 * returned true.
 */
import { sheetSnapPoints } from "../shell/tabBarLogic"
import type { Snap, View } from "../nav"

/** A floor, not a target: the drop-pin fly never zooms out. */
export const DROP_PIN_ZOOM = 17

export function worldPx(zoom: number): number {
  return 512 * 2 ** zoom
}

// Copied verbatim from maplibre-gl's src/geo/mercator_coordinate.ts so the two never drift. The
// longitude pair is not: round-tripping through it is exact in real numbers but not in float64.
function mercatorYfromLat(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360
}

function latFromMercatorY(y: number): number {
  const y2 = 180 - y * 360
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}

export interface DropPinCameraInput {
  lat: number
  lng: number
  currentZoom?: number | null
  windowHeight: number
  sheetTopReserve: number
  /**
   * Native: `useSafeAreaInsets().top`; web: the app-download banner's measured height. Clamped into the
   * strip, so an oversized value sits the pin on the sheet's top edge and a non-finite one degrades to 0.
   */
  topInset?: number
  /**
   * `useNavStore.getState().snap` read after `openDropPinMenu`, which can move the sheet. Defaults to MID.
   */
  sheetDetent?: Snap
  /**
   * `expandedFramePlan(...).occlusionLeft`, never the card width or a literal: the card floats in from the
   * window edge and is user-resizable, and in map mode only the shell inset remains.
   */
  occlusionLeft?: number
  mode: "compact" | "expanded"
}

/** A camera centre, not the pin position. */
export interface DropPinCameraTarget {
  lat: number
  lng: number
  zoom: number
}

/**
 * An explicit three-way rather than `detents[detent]`: hosts feed this from the nav store at runtime, so a
 * stale or absent value must land on MID instead of reading past the tuple and offsetting by NaN.
 */
function occludedHeight(detents: readonly [number, number, number], detent: Snap | undefined): number {
  const [peek, mid, full] = detents
  if (detent === 0) return peek
  if (detent === 2) return full
  return mid
}

/**
 * Runtime sources (safe-area insets before first layout, a banner before it paints) can be undefined or
 * NaN, which would otherwise poison the offset and silently cancel the shift.
 */
function topInsetOf(input: DropPinCameraInput): number {
  const raw = input.topInset ?? 0
  return Number.isFinite(raw) ? Math.max(raw, 0) : 0
}

/**
 * Shared by the drop-pin fly and the web home map's focus, fly-to and pick-start eases, so every camera
 * move centres its target in the same visible strip. A zero shift returns the longitude bit-identically.
 */
export function occludedCenterLng(lng: number, occlusionLeft: number, zoom: number): number {
  const offsetPx = occlusionLeft / 2
  if (!Number.isFinite(offsetPx) || offsetPx <= 0) return lng
  const shifted = lng - (offsetPx / worldPx(zoom)) * 360
  // The shift is westward, so a point just east of the dateline can overflow past -180.
  return shifted < -180 ? shifted + 360 : shifted > 180 ? shifted - 360 : shifted
}

export function dropPinCameraTarget(input: DropPinCameraInput): DropPinCameraTarget {
  const { lat, lng, currentZoom, windowHeight, sheetTopReserve, sheetDetent, mode } = input
  const zoom = Math.max(currentZoom ?? 0, DROP_PIN_ZOOM)

  if (mode !== "compact") {
    return { lat, lng: occludedCenterLng(lng, input.occlusionLeft ?? 0, zoom), zoom }
  }

  const occluded = occludedHeight(sheetSnapPoints(windowHeight, sheetTopReserve), sheetDetent)
  // Past the strip's bottom edge there is no visible map at all, so the sheet's top edge is the least-bad
  // answer; `dropPinFlow` keeps compact off FULL so that case is unreachable.
  const rawInset = topInsetOf(input)
  const inset = Math.min(rawInset, Math.max(windowHeight - occluded, 0))
  const offsetPx = (occluded - inset) / 2
  // Skip the projection round trip so a zero shift returns the latitude bit-identically.
  if (!Number.isFinite(offsetPx) || offsetPx === 0) return { lat, lng, zoom }

  // Mercator Y grows southward, so adding the offset moves the centre south and lifts the pin.
  const y = mercatorYfromLat(lat) + offsetPx / worldPx(zoom)
  const clamped = Math.min(Math.max(y, 0), 1)
  return { lat: latFromMercatorY(clamped), lng, zoom }
}

// A dismissal and a commitment both take the drop-pin entry off the nav stack. "Report an issue here"
// changes the view; "Host an event here" then publish leaves [drop-pin, cleanup], so the drop-pin entry
// leaves later as collateral of the event detail closing. Only a real dismissal removes it from the top.

export interface DropPinCameraSnapshot {
  from: DropPinCameraTarget
  flownTo: DropPinCameraTarget
  view: View
}

/**
 * `previousStack` is typed structurally so this module imports nothing from `../nav` but two type
 * aliases.
 */
export interface DropPinDismissal {
  previousStack: readonly { kind: string }[]
  view: View
  viewport: { center: { lat: number; lng: number }; zoom: number } | null
}

/**
 * Screen pixels, not degrees. The floor (the bbox-midpoint vs Mercator-centre curvature gap) is under
 * 0.011px at `DROP_PIN_ZOOM`; the ceiling is the platform's ~10pt pan slop, so 12 lets a trembling finger
 * through while any real drag cancels the restore. A degree tolerance such as `SETTLED_COORDINATE_EPSILON`
 * would be ~20px at z17.
 *
 * Holds only while both seams disable the rotate and pitch gestures: with pitch the reported bbox is a
 * trapezoid whose midpoint can sit hundreds of px from the camera centre, and this needs re-deriving.
 */
export const DROP_PIN_PAN_TOLERANCE_PX = 12

/**
 * Matches the mobile host's `SETTLED_ZOOM_EPSILON`, so a camera the host calls "arrived" is never called
 * "panned". Restated because @civfix/ui must not import from the app.
 */
export const DROP_PIN_PAN_ZOOM_TOLERANCE = 0.1

/** Shortest signed delta, so a -179.9 to +179.9 step is 0.2 deg, not 359.8. */
function lngDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

/**
 * The zoom gate stops a wide `snapshot.from` laundering a real pan: 160px at z17 is only 10px at z13.
 */
function explainsViewport(
  camera: DropPinCameraTarget,
  viewport: { center: { lat: number; lng: number }; zoom: number },
): boolean {
  const values = [
    camera.lat,
    camera.lng,
    camera.zoom,
    viewport.center.lat,
    viewport.center.lng,
    viewport.zoom,
  ]
  // Fail closed: an unexplained camera move is worse than a missing restore.
  if (!values.every((value) => Number.isFinite(value))) return false
  if (Math.abs(viewport.zoom - camera.zoom) > DROP_PIN_PAN_ZOOM_TOLERANCE) return false
  const world = worldPx(camera.zoom)
  const dy = (mercatorYfromLat(viewport.center.lat) - mercatorYfromLat(camera.lat)) * world
  const dx = (lngDelta(viewport.center.lng, camera.lng) / 360) * world
  return Math.hypot(dx, dy) <= DROP_PIN_PAN_TOLERANCE_PX
}

/**
 * Every uncertain input returns false: a missing restore goes unnoticed, an unexplained camera move does
 * not.
 */
export function shouldRestoreDropPinCamera(
  snapshot: DropPinCameraSnapshot | null,
  dismissal: DropPinDismissal,
): boolean {
  if (!snapshot) return false
  // A view change is a commitment: `selectView("report")` empties the stack exactly as Cancel does.
  if (dismissal.view !== snapshot.view) return false
  // Buried under a dismissed event detail, flying would yank the camera off the event just created.
  if (dismissal.previousStack[dismissal.previousStack.length - 1]?.kind !== "drop-pin") return false
  // A fly issued with no map queues and replays onto the next mount, a surface the user has left.
  if (!dismissal.viewport) return false
  // A pan or zoom while the menu was open cancels the restore. `from` is accepted too because the native
  // seam publishes only on region settle, so a dismissal during the fly still sees the pre-press camera.
  return (
    explainsViewport(snapshot.flownTo, dismissal.viewport) ||
    explainsViewport(snapshot.from, dismissal.viewport)
  )
}
