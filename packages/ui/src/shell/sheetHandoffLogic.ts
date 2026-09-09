/**
 * sheetHandoffLogic — PURE math for the compact sheet's CONTENT-SCROLL -> SHEET-DRAG handoff.
 *
 * gorhom's `animatedPosition` is the sheet's TOP edge in container px: LARGER = lower on screen.
 * `detents` are those same positions, detents[0] = peek (largest) .. detents[n-1] = full (smallest).
 *
 * THE CONTRACT:
 *  - DOWNWARD-ONLY, and DOMINANTLY so. Pulling up at the top of the content must give the drag back to
 *    the scroll view, and a mostly-sideways drag must be left to whatever horizontal scroller is under
 *    the finger (see HANDOFF_AXIS_RATIO).
 *  - NO LOST PIXELS: the caller re-baselines every frame the list is still consuming the drag, so the
 *    instant the list bottoms out at offset 0 the sheet moves from THAT finger position, zero dead zone.
 *  - The sheet can never be dragged past its detents (no enablePanDownToClose, so peek is the floor).
 *  - THE DRAG NEVER LANDS EXACTLY ON A DETENT (see FLOOR_EPSILON) — gorhom's animateToPosition
 *    early-returns on `position === animatedPosition.get()` BEFORE emitting onAnimate/onChange, so an
 *    exact landing would silently strand the sheet at peek with the store still on the old snap.
 */

/** Downward finger travel (pt) at the top of the content before the sheet takes the drag.
 *  8, NOT 2: the content region is a fixed height, so most detail bodies do not scroll at mid snap and
 *  scrollY is pinned at 0 across the whole body — the pan is armed everywhere. Activating an RNGH Pan
 *  cancels the RN touch responder underneath it, so a 2pt threshold cancels any press with >=2pt of
 *  downward finger drift. iOS's own scroll pan threshold is ~10pt. */
export const HANDOFF_SLOP = 8

/** Sub-pixel standoff from the detent bounds. See the exact-equality note above. */
export const FLOOR_EPSILON = 0.5

/** How much more VERTICAL than horizontal the finger must have travelled for the sheet to take the drag.
 *  Without an axis test, a swipe across a nested HORIZONTAL scroller (the report detail's photo strip,
 *  the event detail's linked-reports strip — both plain RN ScrollViews the host never wraps, so the
 *  `horizontal` pass-through never sees them) engages on its incidental downward drift: the ancestor pan
 *  activates, the strip's own scroll is cancelled, and the sheet is dragged toward peek instead. */
export const HANDOFF_AXIS_RATIO = 1.5

export function shouldEngageHandoff(
  scrollY: number,
  dy: number,
  slop: number = 8,
  dx: number = 0,
): boolean {
  "worklet"
  if (scrollY > 0 || dy <= slop) return false
  const across = dx < 0 ? -dx : dx
  return dy > across * 1.5 // literal: see HANDOFF_AXIS_RATIO (worklet const-capture trap)
}

export function handoffPosition(
  basePosition: number,
  translationY: number,
  baseTranslation: number,
  highestPosition: number,
  lowestPosition: number,
): number {
  "worklet"
  const delta = translationY - baseTranslation
  const next = basePosition + (delta > 0 ? delta : 0)
  const floor = lowestPosition - 0.5 // literal: worklet default-param/const-capture trap
  const ceil = highestPosition + 0.5
  if (next < ceil) return ceil
  if (next > floor) return floor
  return next
}

/** The detent INDEX a released handoff settles on. Returning an INDEX (not a position) makes the
 *  exact-membership requirement structural: the caller reads detents[i], so indexOf can never be -1
 *  (which gorhom maps to handleOnClose == full dismissal). */
export function handoffDestinationIndex(
  position: number,
  velocityY: number,
  detents: readonly number[],
): number {
  "worklet"
  const projected = position + 0.2 * velocityY // same projection gorhom's own snapPoint uses
  let best = -1
  let bestDelta = Number.POSITIVE_INFINITY
  for (let i = 0; i < detents.length; i++) {
    const d = detents[i]
    if (d === undefined) continue
    const delta = Math.abs(projected - d)
    if (delta < bestDelta) {
      best = i
      bestDelta = delta
    }
  }
  return best
}
