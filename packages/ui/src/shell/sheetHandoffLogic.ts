/**
 * Pure math for the compact sheet's content-scroll to sheet-drag handoff. gorhom's `animatedPosition` is
 * the sheet's top edge in container px (larger = lower); detents[0] is peek (largest).
 *
 *  - Downward-only, and dominantly so: pulling up gives the drag back to the scroll view, and a mostly
 *    sideways drag is left to any horizontal scroller under the finger.
 *  - No lost pixels: the caller re-baselines every frame the list still consumes the drag, so the sheet
 *    moves from the finger position the instant the list bottoms out.
 *  - The drag never lands exactly on a detent: gorhom's animateToPosition early-returns on
 *    `position === animatedPosition.get()` before emitting onAnimate/onChange, which would strand the
 *    sheet at peek with the store still on the old snap.
 */

/** Most detail bodies do not scroll at mid snap, so the pan is armed across the whole body, and an
 *  activating RNGH Pan cancels the RN touch responder beneath it: a 2pt slop cancelled any press with 2pt
 *  of downward drift. iOS's own scroll pan threshold is about 10pt. */
export const HANDOFF_SLOP = 8

/** Sub-pixel standoff from the detent bounds (see the exact-landing note above). */
export const FLOOR_EPSILON = 0.5

/** Without an axis test, a swipe across a nested horizontal strip (plain RN ScrollViews the host never
 *  wraps, such as a report's photo strip) engaged on its incidental downward drift, cancelling the strip's
 *  scroll and dragging the sheet instead. */
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

/** Returns an index, not a position, so the caller reads detents[i] and can never hit indexOf -1, which
 *  gorhom maps to handleOnClose (a full dismissal). */
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
