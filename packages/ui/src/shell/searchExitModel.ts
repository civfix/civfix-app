/**
 * PURE decisions for LEAVING Search. No react, no react-native, no reanimated — the platform seams
 * (SearchHeader.native's useDockedSearchRise, TabBar.native's morph effect) wire animations AROUND these,
 * so the semantics of the exit are unit-testable with zero native deps.
 *
 * SCOPE: the LEADING glass circle only (TabBar.native's `onExitSearch`). The trailing ✕ (`onClearSearch`)
 * clears the query + blurs and STAYS in Search — `searchActive` is still true for it, so it keeps its
 * existing animated dockFocus collapse.
 */

export interface FocusSettleCommand {
  /** Where `focusProgress` must end up. */
  target: 0 | 1
  /** Animate on `dockFocus` (200ms), or settle THIS FRAME so no second curve runs. */
  animated: boolean
}

/**
 * How close `p` (the dock morph progress, TabBar.native's shared value) must be to 1 for the instant
 * settle below to be geometrically SAFE.
 *
 * Re-derived from `dockShapes` (surface/liquidGlass/liquidGlassModel.ts:121-173), with the LITERAL
 * defaults it uses on the UI-thread worklet path (h=64, gap=12, DOCK_MORPH_SHRINK=16):
 *   u(p)        = lerp(p, 64, 48) = 64 - 16p
 *   rightWp(p)  = lerp(p, u, wide),  wide = regionW - u - 12
 *   rightX(f,p) = lerp(f, regionW - rightWp(p), u + 12)
 * Settling f from f0 -> 0 at fixed p steps rightX by
 *   delta(p) = f0 * [(regionW - rightWp(p)) - (u(p) + 12)]
 *            = f0 * (1 - p) * (regionW - 2*u(p) - 12)     -- algebra below
 * which is EXACTLY 0 at p=1 (the case this settle was built for; see `focusSettleCommand`'s history) and
 * grows as p falls away from 1. Worked example (regionW=300, p=0.5, f0=1): u=56, delta = 0.5*(300-112-12)
 * = 88pt — a real sideways jump, not the "nothing translates" case the settle assumes.
 *
 * THRESHOLD: EPSILON = 0.01, i.e. settle only when p >= 1 - EPSILON = 0.99. `dockMorphIn` is a 200ms
 * EASE_STANDARD timing (theme/motion.ts) whose front-loaded curve is past 0.99 well before it lands, so the
 * threshold fires only once the ENTER morph is visually done, and never in its first, fast frames. Worst-case
 * discontinuity this permits, using the widest current device dock region (iPhone 16 Pro Max, regionW ~= 430pt)
 * and worst-case f0=1:
 *   delta(0.99) = 1 * 0.01 * (430 - 2*(64-16*0.99) - 12) = 0.01 * (430 - 96.32 - 12) ~= 3.2pt
 * ~3pt is a sub-pixel-adjacent nudge on the field's right edge, not a visible snap; an EPSILON of 0.05 would
 * already reach ~16pt (visible), which is why this stays tight.
 */
export const FOCUS_SETTLE_P_EPSILON = 0.01

/**
 * How `focusProgress` must move.
 *
 * WHY THE SETTLE: `dockShapes(p, regionW, f, …)` (surface/liquidGlass/liquidGlassModel.ts:121-173) takes
 * BOTH progresses and multiplies them into one glass width —
 *   rightW = lerp(f, rightWp(p), fieldFocusW)
 * — so timing `f` 1->0 on dockFocus at the same moment `p` times 1->0 on dockMorphOut makes the field's
 * width a product of two easings. Settling `f` on the exit's first frame leaves `p` as the sole animating
 * input, which is the whole point: ONE curve carries the dismissal.
 *
 * The settle is geometrically cheap ONLY near p=1: there, `rightX` is identical at f=1 and f=0
 * (regionW - rightWp == u + gap), so nothing translates — only the field's right edge steps out by
 * (u + gap) = 60pt as the trailing ✕ circle leaves, on the same frame dockMorphOut has already taken p
 * past 0.85. At p < 1 (see FOCUS_SETTLE_P_EPSILON above) that identity does NOT hold, so a fast
 * tap-into-Search-then-exit (the exit hit-target and field are both live from `searchActive`'s first frame,
 * well before p reaches 1) would settle f into a real lateral jump. Below the threshold this falls back to
 * the SAME animated `dockFocus` retarget the ✕-clear path uses, which is smooth at any p — the behavior this
 * whole task existed to improve on, minus its blind spot.
 *
 * `p` is read, never driven, by this function: the caller (SearchHeader.native's useDockedSearchRise) owns
 * the reanimated shared value and passes its current `.value` in — this file stays free of any reanimated
 * import so it is unit-testable with zero native deps.
 *
 * REDUCE MOTION: `animated: false` IS the reduce-motion-safe path (a straight assignment). The caller
 * keeps `ReduceMotion.System` on the animated branch.
 */
export function focusSettleCommand(pinned: boolean, searchActive: boolean, p: number): FocusSettleCommand {
  if (!searchActive) return { target: 0, animated: !(p >= 1 - FOCUS_SETTLE_P_EPSILON) }
  return { target: pinned ? 1 : 0, animated: true }
}

/**
 * What the dock morph must publish about the search body's EXIT FREEZE when `view` changes.
 *
 *  - "reset"  : Search is being ENTERED — arm the freeze for the NEXT exit (publish settled = false).
 *  - "hold"   : an ANIMATED exit is under way — publish nothing now; release when the dockMorphOut timing
 *               lands, so the two remounts fall on a quiet, fully-transparent overlay instead of on the
 *               fade frames.
 *  - "settle" : there is no fade to protect (OS reduce-motion, or the dock has not measured yet and `p`
 *               jumps straight to the target) — publish settled = true immediately.
 *
 * Note "hold" deliberately publishes NOTHING at exit-start: the freeze is already live, because
 * `isSearchBodyFrozen` derives it from the nav view in the very render that clears the query. Publishing
 * "frozen = true" from an effect here would always be one commit too late.
 */
export type SearchExitPublish = "reset" | "hold" | "settle"

export function searchExitPublish(morphTarget: 0 | 1, animated: boolean): SearchExitPublish {
  if (morphTarget === 1) return "reset"
  return animated ? "hold" : "settle"
}
