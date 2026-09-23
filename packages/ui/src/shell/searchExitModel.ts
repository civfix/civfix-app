/**
 * Pure decisions for leaving Search, with no react, react-native or reanimated, so the exit semantics are
 * testable with zero native deps; the platform seams wire animations around them. Scope: the leading glass
 * circle (`onExitSearch`) only. The trailing clear button (`onClearSearch`) clears and blurs but stays in
 * Search, keeping its animated dockFocus collapse.
 */

export interface FocusSettleCommand {
  target: 0 | 1
  /** False settles this frame so no second curve runs; it is also the reduce-motion-safe path. */
  animated: boolean
}

/**
 * How close the dock morph progress `p` must be to 1 for the instant settle to be geometrically safe.
 * From `dockShapes` (surface/liquidGlass/liquidGlassModel) with its UI-thread literals (h=64, gap=12,
 * DOCK_MORPH_SHRINK=16), settling f from f0 to 0 at fixed p moves the field sideways by
 *   delta(p) = f0 * (1 - p) * (regionW - 2*u(p) - 12),  u(p) = 64 - 16p
 * which is 0 at p=1 and grows as p falls. At 0.99 the worst case (regionW ~= 430pt on the widest phone,
 * f0=1) is ~3.2pt, an invisible nudge; 0.05 would already reach ~16pt. `dockMorphIn`'s front-loaded curve
 * passes 0.99 only once the enter morph is visually done.
 */
export const FOCUS_SETTLE_P_EPSILON = 0.01

/**
 * `dockShapes` multiplies both progresses into one glass width, so timing `f` on dockFocus while `p` times
 * out on dockMorphOut makes the field's width a product of two easings. Settling `f` on the exit's first
 * frame leaves one curve carrying the dismissal. That is only safe near p=1 (see FOCUS_SETTLE_P_EPSILON):
 * a fast tap-into-Search-then-exit can leave p well below 1, and there this falls back to the animated
 * dockFocus retarget, which is smooth at any p.
 */
export function focusSettleCommand(pinned: boolean, searchActive: boolean, p: number): FocusSettleCommand {
  if (!searchActive) return { target: 0, animated: !(p >= 1 - FOCUS_SETTLE_P_EPSILON) }
  return { target: pinned ? 1 : 0, animated: true }
}

/**
 *  - "reset": entering Search arms the freeze for the next exit.
 *  - "hold": an animated exit publishes nothing until dockMorphOut lands. The freeze is already live
 *    because `isSearchBodyFrozen` derives it from the nav view in the render that clears the query; a
 *    flag published from an effect would be one commit too late.
 *  - "settle": no fade to protect (reduce motion, or an unmeasured dock), so publish settled at once.
 */
export type SearchExitPublish = "reset" | "hold" | "settle"

export function searchExitPublish(morphTarget: 0 | 1, animated: boolean): SearchExitPublish {
  if (morphTarget === 1) return "reset"
  return animated ? "hold" : "settle"
}
