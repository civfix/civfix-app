/**
 * Drag-a-detail-to-peek gating, kept out of CompactShell.native so it is testable without a
 * gorhom/reanimated renderer. `collapseToParent` no-ops when no detail is open or a flow kind is on the
 * stack, so this only answers "is the sheet heading to, or resting at, peek?".
 */

/** Animated-index fraction below which the armed parent swap fires. */
export const COLLAPSE_SWAP_AT = 0.7

/**
 * Gates both gorhom's onAnimate destination and onChange arrival. Neither looks at where the sheet came
 * from: an interrupted pull-up never settles, so the following pull-down still reports `from` 0, and
 * requiring a taller origin would strand the detail at peek.
 */
export function isPeekIndex(index: number): boolean {
  return index === 0
}
