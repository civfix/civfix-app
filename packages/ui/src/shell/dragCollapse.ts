/**
 * Drag-a-detail-to-peek gating, kept out of CompactShell.native so it is testable without a
 * gorhom/reanimated renderer. `collapseToParent` no-ops when no detail is open or a flow kind is on the
 * stack, so these predicates only answer "is the sheet heading to, or resting at, peek?".
 */

/** Animated-index fraction below which the armed parent swap fires. */
export const COLLAPSE_SWAP_AT = 0.7

/**
 * For gorhom's onAnimate(from, to). Gates on the destination only: an interrupted pull-up never settles,
 * so the following pull-down still reports `from` 0, and requiring `from > 0` would strand the detail.
 */
export function armCollapse(_fromIndex: number, toIndex: number): boolean {
  return toIndex === 0
}

/**
 * Settle-time backstop for gorhom's onChange. Gates on the arrival index only, for the same interrupted
 * pull-up reason as `armCollapse`, so the revert happens even when the mid-animation path never armed.
 */
export function shouldCollapseOnSettle(index: number, _prevIndex: number): boolean {
  return index === 0
}
