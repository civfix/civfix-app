/**
 * Where the camera must sit so a long-pressed point lands in the VISIBLE strip of map beside/above the
 * drop-pin pull-up (map long-press -> drop pin -> create menu).
 *
 * THE PROBLEM. The drop-pin surface OVERLAYS the live map in both layout modes, so flying the camera
 * straight to the pressed coordinate centres it in the WHOLE window - i.e. underneath the surface. The
 * centre therefore has to be pushed AWAY from the pressed point, by exactly the distance between the
 * window's centre and the VISIBLE STRIP's centre, so the pin ends up centred in the strip that is still
 * visible. The two modes occlude on different AXES:
 *
 *   - COMPACT: the sheet covers the bottom `sheetSnapPoints(windowHeight, sheetTopReserve)[detent]` px and
 *     the notch / status bar (native) or the app-download banner (web) covers the TOP `topInset` px, so the
 *     shift is VERTICAL and the strip to centre in is `[topInset, windowHeight - occluded]`.
 *   - EXPANDED: `shell/ExpandedShell` renders the rail and the floating card over the LEFT edge, at z65/z60
 *     OVER the full-bleed map (AppShell z0) - they are not layout columns that shrink the viewport. So the
 *     occlusion there is HORIZONTAL and the shift is the exact mirror: the centre goes WEST by half
 *     `occlusionLeft`, and the pressed point slides into the strip of map to the RIGHT of the chrome.
 *     This module used to return the expanded input UNTOUCHED, on the (wrong) reasoning that a "side rail"
 *     does not occlude vertically - true, but it occludes HORIZONTALLY, and a long press on the left third
 *     of a landscape window then planted the pin behind the panel.
 *
 * THE TOP OCCLUSION IS NOT ZERO, AND AT FULL IT IS THE WHOLE STRIP. `sheetSnapPoints` CLAMPS its `full`
 * anchor to `windowHeight - topReserve`, so `windowHeight - full` collapses to exactly `sheetTopReserve` -
 * which on native IS `insets.top + the gap`. Centring in `[0, windowHeight - occluded]` therefore put the
 * pin at `sheetTopReserve / 2` at the FULL detent: y=45.5 on an iPhone 16 (874 / insets.top 59), i.e. 13.5px
 * ABOVE the safe-area boundary and drawn under the Dynamic Island. That is why `topInset` exists and why the
 * offset is half the UNOCCLUDED band, `(occluded - topInset) / 2`, not half the occluded one. The inset is
 * clamped into the strip so a bogus or oversized value (a tall web banner) can never push the pin DOWN under
 * the sheet, and a negative offset is legitimate: when the top occluder is taller than the sheet (a banner
 * over a peeked sheet) the strip's centre really is BELOW the window's, and the centre must move north.
 *
 * WHICH DETENT, AND WHY IT IS AN INPUT. `openDropPinMenu` opens via `useNavStore.openDetail`, whose
 * `openIfPeeked` bumps a PEEKED sheet to MID and used to KEEP a FULL one. Offsetting by `mid / 2` for a
 * sheet that had settled at FULL dropped the pin (full - mid) / 2 px BELOW the sheet's top edge - hidden.
 * `sheetDetent` therefore carries the detent the sheet will ACTUALLY settle at and the host must read it
 * AFTER calling `openDropPinMenu` (reading it before yields the pre-open detent). It defaults to 1 (MID) so
 * an older caller keeps the previous behaviour and still compiles.
 *
 * `dropPinFlow` NOW SETTLES COMPACT AT MID, so on both hosts this input is 1 in practice - see that module's
 * header for why FULL is not a viewable detent for a drop pin at all (the strip is 32px on every notched
 * phone and the DropPin teardrop is 52pt, so no camera can fit the art in it; on mobile web with a banner
 * the strip is NEGATIVE). `sheetDetent` stays an input anyway: the camera must follow what the STORE
 * settles at rather than duplicate an assumption about it, and the FULL branch has to be geometrically
 * right for any caller that does pass 2.
 *
 * THE MATH. Web Mercator, at the 512-px-per-tile world convention both maplibre-gl and MapLibre-native
 * use: `worldPx(zoom) = 512 * 2**zoom`. A vertical screen offset of `px` is `px / worldPx(zoom)` in
 * normalised Mercator Y, and Mercator Y grows SOUTHWARD - so the shifted centre is
 * `latFromMercatorY(mercatorYfromLat(lat) + px / worldPx(zoom))`. The two helpers below are copied
 * VERBATIM from maplibre-gl's `src/geo/mercator_coordinate.ts` so the two never drift. The HORIZONTAL case
 * needs no helper at all: `mercatorXfromLng(lng) === (180 + lng) / 360` is LINEAR, so a normalised-X delta
 * of `px / worldPx(zoom)` is exactly `px / worldPx(zoom) * 360` degrees of longitude - subtracting that
 * directly is both simpler and float-exact next to round-tripping through the pair.
 *
 * WORKED EXAMPLES (the sim target). windowHeight 874, insets.top 59 -> sheetTopReserve 91 -> detents
 * [96, 487, 783]. At MID the visible strip is [59, 387], its centre is y=223, offset = (487 - 59)/2 = 214px,
 * which at lat 37.7749 / zoom 17 is a 9.074e-4 deg latitude shift. At FULL the strip is [59, 91], centre
 * y=75, offset = (783 - 59)/2 = 362px -> 1.535e-3 deg. With `topInset` omitted (0) those revert to the
 * old 243.5px / 1.033e-3 and 391.5px / 1.660e-3. Expanded at the default `occlusionLeft` (14 shell inset +
 * 440 card = 454): offset = 227px -> a 1.21772e-3 deg longitude shift WEST; in map mode, where the card is
 * hidden and only the shell's own 14px inset occludes, offset = 7px.
 * `map/__tests__/dropPinCamera.test.ts` pins all of those magnitudes - which is what catches a world-size
 * constant that is 2x too large or too small - AND asserts, by inverting the projection back to a screen y
 * (compact) / x (expanded), that the pin lands centred in the strip the user can actually see.
 *
 * Pure - no react-native / maplibre / next / zustand - so it unit-tests directly and both seams plus the
 * two app hosts may import it. THE HOST OWNS THE CAMERA: neither Map seam runs a drop-pin camera effect;
 * each app's map screen feeds this target into its own generation-guarded flyTo, and must fly ONLY when
 * `openDropPinMenu` returned true (it declines while a creation flow owns the stack - a fly with no pin and
 * no menu is a camera yank out of nowhere).
 */
import { sheetSnapPoints } from "../shell/tabBarLogic"
import type { Snap, View } from "../nav"

/** Street level. The drop-pin fly NEVER zooms out - it is a floor, not a target (see `dropPinCameraTarget`). */
export const DROP_PIN_ZOOM = 17

/** The Mercator world size in px at a zoom, at maplibre's 512-px tile convention. */
export function worldPx(zoom: number): number {
  return 512 * 2 ** zoom
}

// --- maplibre-gl mercator_coordinate.ts, verbatim -------------------------------------------------
// Only the LATITUDE pair is reproduced. The longitude pair is NOT: `mercatorXfromLng` is linear
// ((180 + lng) / 360), so the horizontal shift is a plain degree subtraction (see the header) - and
// round-tripping an unshifted longitude through mercatorXfromLng/lngFromMercatorX is an exact identity in
// real numbers but not in float64, so it would perturb the pressed longitude for no gain.
function mercatorYfromLat(lat: number): number {
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360
}

function latFromMercatorY(y: number): number {
  const y2 = 180 - y * 360
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
}
// --------------------------------------------------------------------------------------------------

export interface DropPinCameraInput {
  /** The long-pressed coordinate (the point the PIN is planted on). */
  lat: number
  lng: number
  /**
   * The map's current zoom, if known. The target zoom is `max(currentZoom ?? 0, DROP_PIN_ZOOM)` - a
   * long press while already at z19 must NOT yank the user back out to z17.
   */
  currentZoom?: number | null
  /** The window height in px (compact only - drives the sheet detents). */
  windowHeight: number
  /** Everything reserved ABOVE the fully-expanded sheet (native: safe-area top + the breathing gap). */
  sheetTopReserve: number
  /**
   * The px of map OCCLUDED AT THE TOP of the window, measured from y=0: `useSafeAreaInsets().top` on native
   * (status bar / notch / Dynamic Island), the app-download banner's published height
   * (`useAppPromoStore.getState().bannerHeight`) on web. Compact only. Defaults to 0, which reproduces the
   * pre-`topInset` behaviour exactly.
   *
   * NOT cosmetic: `sheetSnapPoints` clamps `full` to `windowHeight - sheetTopReserve`, so at the FULL detent
   * the entire strip left over IS this inset plus the breathing gap - centring in `[0, ...]` there planted
   * the pin under the notch (see the header). Clamped into the strip here, so an oversized value degrades to
   * "sit on the sheet's top edge" instead of vanishing below it, and a non-finite one degrades to 0.
   */
  topInset?: number
  /**
   * The detent the sheet will SETTLE at once the menu is open - `useNavStore.getState().snap` read AFTER
   * `openDropPinMenu`, not before. Defaults to 1 (MID), the detent `openIfPeeked` produces from a peeked
   * sheet; a FULL sheet stays FULL and needs the bigger offset. Compact only.
   */
  sheetDetent?: Snap
  /**
   * The px of map the expanded shell's chrome hides from the LEFT edge:
   * `expandedFramePlan({ view, stackLength, sidebarWidth }).occlusionLeft` - the shell's own 14px left
   * inset plus the LIVE card width, or the bare inset in map mode where the card is hidden (the top nav
   * strip is a horizontal bar now, so it costs the map no horizontal space of its own). Read it from the
   * frame plan; never hardcode it (the card is user-resizable and the default has already moved once).
   * Expanded only; omit (or pass 0) to get the un-shifted pass-through.
   *
   * IT IS NOT THE CARD'S WIDTH, and the difference is not cosmetic. The card floats `NAV_LEFT` px in from
   * the window's edge, so offsetting by half the CARD leaves the pin 7px west of the visible strip's
   * centre at EVERY width, and says nothing at all about map mode - where the card is gone but the shell's
   * own inset still applies. (The pre-frame-plan version of this input dropped that inset deliberately, on
   * the grounds that 7px is below any perceptual threshold and the literal was not exported. The frame
   * plan exports the whole number now, so that trade is void.)
   */
  occlusionLeft?: number
  /**
   * @deprecated Pass {@link occlusionLeft} instead - `occlusionLeft` wins when both are present.
   *
   * The pre-rail input: the card's live width alone. Kept because civfix-mobile's tablet host still passes
   * it and this package must not break its typecheck from the outside; a caller that keeps passing it gets
   * the old centring (45px west of the strip's centre), which is stale but not broken.
   */
  sidebarWidth?: number
  /** The live layout mode. Compact occludes the map VERTICALLY, expanded HORIZONTALLY. */
  mode: "compact" | "expanded"
}

/** The camera the host should fly to: a CENTRE (not the pin) plus the resolved zoom. */
export interface DropPinCameraTarget {
  lat: number
  lng: number
  zoom: number
}

/**
 * How many px of the window the sheet covers at a detent. Written as an explicit three-way rather than
 * `detents[detent]` on purpose: typed callers can only pass 0 | 1 | 2, but the hosts feed this straight from
 * the nav store at runtime, so an absent/stale/JS value must land on MID (the detent `openDetail` actually
 * produces) instead of reading past the end of the tuple and offsetting by NaN - i.e. not offsetting at all.
 */
function occludedHeight(detents: readonly [number, number, number], detent: Snap | undefined): number {
  const [peek, mid, full] = detents
  if (detent === 0) return peek
  if (detent === 2) return full
  return mid
}

/**
 * The top occlusion, floored at 0 and defaulting to 0 for a non-finite value. Same reasoning as
 * `occludedHeight`: the hosts feed this from a runtime source (`useSafeAreaInsets()` before the first layout
 * pass, a promo store's measured height before the banner has painted), so an undefined / NaN / negative
 * value must degrade to "no top occlusion" - i.e. the pre-`topInset` centring - rather than poison the whole
 * offset with NaN and silently cancel the shift the user long-pressed for.
 */
function topInsetOf(input: DropPinCameraInput): number {
  const raw = input.topInset ?? 0
  return Number.isFinite(raw) ? Math.max(raw, 0) : 0
}

/**
 * The camera longitude that centres `lng` in the strip of map left clear by `occlusionLeft` px of chrome on
 * the window's left edge - the WHOLE of the expanded shell's horizontal occlusion math, exported because two
 * flows need it: the drop-pin fly below, and the main-map LOCATION PICK (`Map.web`'s pick-start camera, the
 * seam the report / host-event location step drives through `locationPickStore`). Both centre a point the
 * user is about to place a pin on, and both would otherwise park it behind the card.
 *
 * `occlusionLeft <= 0` (or non-finite) returns the longitude BIT-IDENTICALLY rather than perturbing it by
 * float error for a zero shift - which is also the compact / portrait answer, where the chrome occludes
 * vertically and this function is never called.
 */
export function occludedCenterLng(lng: number, occlusionLeft: number, zoom: number): number {
  const offsetPx = occlusionLeft / 2
  if (!Number.isFinite(offsetPx) || offsetPx <= 0) return lng
  // Screen x grows EASTWARD, so SUBTRACTING the offset puts the centre west of the point, which slides the
  // point toward the right of the frame - into the strip beside the chrome.
  const shifted = lng - (offsetPx / worldPx(zoom)) * 360
  // Single-step antimeridian wrap: the shift is WESTWARD, so a point just east of the dateline is the
  // overflow case (lng -179.9999 would otherwise emit -180.0014). In-range values come back
  // BIT-IDENTICAL; this is the horizontal counterpart of the Mercator-Y clamp in the compact branch.
  return shifted < -180 ? shifted + 360 : shifted > 180 ? shifted - 360 : shifted
}

/**
 * The camera target for a drop-pin long press.
 *
 * On COMPACT the returned `lat` is SOUTH of the pressed point by half the band the sheet and the top inset
 * occlude between them, and the `lng` is the pressed longitude untouched; on EXPANDED it is the mirror - the
 * `lng` is WEST of the pressed point by half `occlusionLeft` and the `lat` is untouched. Either way the
 * pressed point ends up centred in the strip of map the drop-pin surface leaves visible.
 */
export function dropPinCameraTarget(input: DropPinCameraInput): DropPinCameraTarget {
  const { lat, lng, currentZoom, windowHeight, sheetTopReserve, sheetDetent, mode } = input
  const zoom = Math.max(currentZoom ?? 0, DROP_PIN_ZOOM)

  if (mode !== "compact") {
    // EXPANDED: the rail + card overlay the map's LEFT edge, so push the centre west by half what they hide.
    return { lat, lng: occludedCenterLng(lng, input.occlusionLeft ?? input.sidebarWidth ?? 0, zoom), zoom }
  }

  const occluded = occludedHeight(sheetSnapPoints(windowHeight, sheetTopReserve), sheetDetent)
  // The visible strip is [inset, windowHeight - occluded], so its centre sits (occluded - inset) / 2 px
  // ABOVE the window's centre - that difference, not half the sheet, is the offset. The inset is clamped to
  // the strip's own bottom edge: past that the strip is entirely behind the top chrome and there is no
  // visible map at all, and pinning the pin to the sheet's top edge is the least-bad answer (see
  // `dropPinFlow`, which keeps compact off the FULL detent precisely so that case is unreachable).
  const rawInset = topInsetOf(input)
  const inset = Math.min(rawInset, Math.max(windowHeight - occluded, 0))
  const offsetPx = (occluded - inset) / 2
  // Exactly zero means the strip's centre IS the window's: skip the projection round trip so the pressed
  // latitude comes back BIT-IDENTICAL rather than perturbed by float error for no shift.
  if (!Number.isFinite(offsetPx) || offsetPx === 0) return { lat, lng, zoom }

  // Mercator Y grows southward, so ADDING the offset pushes the CENTRE south of the pin, which lifts the
  // pin toward the top of the frame - into the strip the sheet leaves visible. A NEGATIVE offset (a top
  // occluder taller than the sheet) correctly pushes the centre north instead.
  const y = mercatorYfromLat(lat) + offsetPx / worldPx(zoom)
  const clamped = Math.min(Math.max(y, 0), 1)
  return { lat: latFromMercatorY(clamped), lng, zoom }
}

// --- THE RESTORE: putting the camera BACK when the pull-up is dismissed ----------------------------
//
// `dropPinCameraTarget` above answers "where must the camera GO". This half answers the mirror question:
// when the pull-up goes away, MAY the camera go back to where the user was? The pre-press viewport was
// never captured before this - the mobile handler read `useMapViewport.getState().viewport` for the zoom
// FLOOR only (app/index.tsx:489) and threw the centre away, and by the time the fly settles
// `acknowledgeMapSettlement` has overwritten `mapLifecycle.lastViewport` with the drop-pin camera and
// `rememberMapViewport` has persisted it. So every dismissal used to leave the camera parked on the pin.
//
// THE HARD PART IS NOT THE MATH - `snapshot.from` IS the answer. It is telling a DISMISSAL apart from a
// COMMITMENT, because both take the drop-pin entry off the nav stack by exactly the same door:
//
//   - Cancel / sheet drag-down / map tap / Android back  -> DISMISSAL. Restore.
//   - "Report an issue here"                             -> `selectView("report")`, which also EMPTIES
//     the stack. The tell is that the VIEW changed.
//   - "Host an event here", then publish                 -> `stackAfterFlowPublished`
//     (bodies/composerCreateFlow.ts:125-134) truncates only up to the topmost FLOW kind, so the stack
//     lands as [drop-pin, cleanup] and the drop-pin entry survives - which is precisely why
//     CreateCleanupBody.tsx:357 clears the marker by hand. It leaves the stack much later, as COLLATERAL
//     of the event detail being dismissed. The tell is POSITIONAL: on a real dismissal the drop-pin entry
//     is the TOP of the stack that is going away.
//
// Both tells are readable from zustand's `(state, prevState)` listener pair with no history tracking, so
// this stays a pure predicate rather than a little state machine.
//
// THIS MODULE STILL NEVER TOUCHES THE CAMERA (see the header): it returns a boolean and the caller flies.

/** The camera the map was on BEFORE a drop-pin long press, plus what is needed to judge the dismissal. */
export interface DropPinCameraSnapshot {
  /** The PRE-PRESS camera - `useMapViewport.getState().viewport` centre + zoom, read before the fly. */
  from: DropPinCameraTarget
  /** The camera the drop-pin fly was ASKED for: `dropPinCameraTarget`'s own return value. */
  flownTo: DropPinCameraTarget
  /** The nav `view` the long press happened on. A different view at dismissal means the user committed. */
  view: View
}

/**
 * What the world looks like at the instant the drop-pin entry leaves the nav stack.
 *
 * `previousStack` is typed STRUCTURALLY (`{ kind: string }`) rather than as `readonly DetailEntry[]` so
 * this module keeps importing nothing from `../nav` but two type aliases - `readonly DetailEntry[]` is
 * assignable to it, so the seam passes zustand's `prevState.stack` straight in.
 */
export interface DropPinDismissal {
  /** The nav stack IMMEDIATELY BEFORE the change that removed the drop-pin entry (zustand `prevState`). */
  previousStack: readonly { kind: string }[]
  /** The nav `view` AFTER that change. */
  view: View
  /** The map's live viewport centre + zoom, or null when no map is mounted / has reported. */
  viewport: { center: { lat: number; lng: number }; zoom: number } | null
}

/**
 * How far the camera may sit from where the APP put it and still count as "unmoved", in SCREEN PIXELS.
 *
 * PIXELS, NOT DEGREES, and it is not a taste call:
 *
 *   FLOOR (essentially free). The only legitimate mismatch is that `useMapViewport.center` is the
 *   ARITHMETIC bbox midpoint (mapViewportStore.ts:39-42), not the Mercator camera centre. That gap is a
 *   second-order curvature term, `pi * sin(lat) * H^2 / (4 * worldPx(z))` px - which at the drop-pin's
 *   guaranteed `z >= DROP_PIN_ZOOM` is 0.0055px on an 874px-tall phone at lat 37.77, 0.0052-0.0062px
 *   across `dropPinCamera.test.ts`'s NOTCHED table, and under 0.011px at ANY latitude. 12 is a ~2200x
 *   margin over it, so the floor does not pick the number.
 *
 *   CEILING (this does pick it). A pan only begins past the platform's ~10pt gesture slop, and a released
 *   drag carries momentum, so the smallest camera translation a real pan produces is ~10pt and in practice
 *   tens. 12 sits just above the slop: a trembling finger does not cancel the restore, any actual drag
 *   does.
 *
 *   THE FLOOR NEVER BITES ON `from`. `snapshot.from` and `dismissal.viewport` are BOTH sourced from
 *   `useMapViewport`, whose center is the bbox midpoint (mapViewportStore.ts:40-42), not a true Mercator
 *   camera centre - so an unmoved camera compares that SAME midpoint formula against itself on both sides
 *   of {@link explainsViewport}, and the curvature term cancels EXACTLY, not merely below tolerance: the
 *   delta is zero at every zoom, low or high, and `from.zoom` matches bit-for-bit too. The curvature budget
 *   above therefore only ever prices the `flownTo` comparison - `flownTo` is a true Mercator centre from
 *   `dropPinCameraTarget`, compared against the midpoint-sourced `dismissal.viewport` - and that endpoint's
 *   zoom is floored at `DROP_PIN_ZOOM` (17) and only ever higher, where the term is ~0.005px, as priced
 *   above. There is no zoom at which either comparison can approach the 12px ceiling on curvature alone.
 *
 *   THE LOAD-BEARING PRECONDITION: ZERO BEARING AND ZERO PITCH. `mapViewportStore.ts:13` documents that
 *   rotation is disabled, which is why the bbox midpoint IS the axis-aligned rectangle's true centre - but
 *   it is silent on pitch. With any pitch the reported bbox is the bounding box of a TILTED FRUSTUM's
 *   footprint on the ground plane, i.e. a trapezoid, whose latitude midpoint can sit HUNDREDS of px away
 *   from the actual camera centre - not a rounding error, and not bounded by the curvature analysis above
 *   at all. That would break the `flownTo` comparison outright rather than degrade it. Both hosts keep
 *   pitch at 0 today; if that ever changes, this whole tolerance derivation needs re-deriving, not re-tuning.
 *
 *   WHY NOT mapLifecycle's SETTLED_COORDINATE_EPSILON (1e-4 deg). That is a ZOOM-BLIND DEGREE tolerance
 *   sized for the worst case at LOW zoom, where the same curvature term really is degrees-scale; at z17 it
 *   is 18.6px of longitude and 23.6px of latitude, i.e. 6-7% of the 328px strip a MID sheet leaves on the
 *   sim device - a visibly panned map.
 */
export const DROP_PIN_PAN_TOLERANCE_PX = 12

/**
 * How far the zoom may drift and still count as "unmoved". Deliberately the SAME 0.1 as
 * `SETTLED_ZOOM_EPSILON` in civfix-mobile's `src/lib/mapLifecycle.ts:107`, on the rule that anything the
 * host is willing to call "the camera ARRIVED at the target" must never be called "the user PANNED". A
 * pinch trivially exceeds it. RESTATED as a literal rather than imported: that constant lives in the app
 * repo (which @civfix/ui must not import) and is module-private there.
 */
export const DROP_PIN_PAN_ZOOM_TOLERANCE = 0.1

/** Signed shortest longitude delta in degrees: a -179.9 -> +179.9 step is 0.2 deg, not 359.8. */
function lngDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

/**
 * Does `camera` still EXPLAIN the observed viewport - same zoom, and within
 * {@link DROP_PIN_PAN_TOLERANCE_PX} screen px at that zoom?
 *
 * The zoom test is not decoration. A wide `snapshot.from` (say z13) is 16x less magnified than the
 * drop-pin camera, so a 160px pan at z17 is only 10px in z13's world - inside the tolerance. Without the
 * zoom gate the wide snapshot would LAUNDER a real pan into "unmoved".
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
  // Fail CLOSED: a non-finite input means we cannot tell, and an unexplained camera move is worse than a
  // missing one (see the `shouldRestoreDropPinCamera` doc).
  if (!values.every((value) => Number.isFinite(value))) return false
  if (Math.abs(viewport.zoom - camera.zoom) > DROP_PIN_PAN_ZOOM_TOLERANCE) return false
  const world = worldPx(camera.zoom)
  const dy = (mercatorYfromLat(viewport.center.lat) - mercatorYfromLat(camera.lat)) * world
  const dx = (lngDelta(viewport.center.lng, camera.lng) / 360) * world
  return Math.hypot(dx, dy) <= DROP_PIN_PAN_TOLERANCE_PX
}

/**
 * May the camera be flown back to `snapshot.from` now that the drop-pin entry has left the stack?
 *
 * Pure, and deliberately conservative: every uncertain input returns FALSE. A missing restore is a beat
 * the user does not notice; an unexplained camera move is the exact complaint `dropPinFlow.ts:9-14`
 * already records about flying with no pin ("a camera yank out of nowhere").
 */
export function shouldRestoreDropPinCamera(
  snapshot: DropPinCameraSnapshot | null,
  dismissal: DropPinDismissal,
): boolean {
  if (!snapshot) return false
  // (1) A VIEW CHANGE IS A COMMITMENT, NOT A DISMISSAL. "Report an issue here" runs
  // `selectView("report")`, which empties the stack - the same observable event a Cancel produces.
  if (dismissal.view !== snapshot.view) return false
  // (2) THE PUBLISH-THEN-DISMISS TRAP. On a genuine dismissal the drop-pin entry is the TOP of the stack
  // that is going away. In the [drop-pin, cleanup] case it is buried UNDER the thing actually being
  // dismissed, and flying would yank the camera off the event the user just created. An empty
  // `previousStack` lands here too (`undefined !== "drop-pin"`), which is correct: nothing left the stack.
  if (dismissal.previousStack[dismissal.previousStack.length - 1]?.kind !== "drop-pin") return false
  // (3) NO MAP, NO RESTORE. Both seams clear the viewport on unmount, and a fly issued with no map queues
  // and replays onto the NEXT mount - a yank on a surface the user has already left.
  if (!dismissal.viewport) return false
  // (4) A PAN OR ZOOM WHILE THE MENU WAS OPEN CANCELS THE RESTORE. The strip of map above the MID sheet is
  // live and pannable; moving it is deliberate and must be respected. The test is "is the camera still
  // where the APP last put it" - and there are TWO such places, because `Map.native.tsx`'s `handleRegion`
  // (:228) is wired to `onRegionDidChange` (:360), the SETTLE event, and nothing publishes continuously:
  // a dismissal that lands DURING the drop-pin fly still finds the PRE-press camera in the store.
  // Comparing against `flownTo` alone would read that as a 214px-or-worse pan and silently drop the
  // restore for the fastest dismissal there is.
  return (
    explainsViewport(snapshot.flownTo, dismissal.viewport) ||
    explainsViewport(snapshot.from, dismissal.viewport)
  )
}
