/**
 * The compact sheet's "drag a detail down to peek => dismiss it" gating, extracted from
 * CompactShell.native so it is unit-testable without a gorhom/reanimated renderer (the package ships none,
 * so the shell tests are pure predicates over the live nav store - see bodyTransition.test.ts).
 *
 * gorhom drives two JS signals the shell turns into a `collapseToParent()`:
 *   - onAnimate(from, to)  : the sheet COMMITTED to a snap transition (gesture release / programmatic),
 *                            at the START of the settle. `from` = the last SETTLED index. We arm the
 *                            mid-animation parent-swap here; a reanimated reaction (kept inline in the
 *                            shell, since it reads a shared value on the UI thread) performs it once the
 *                            animated index drops past COLLAPSE_SWAP_AT.
 *   - onChange(index)      : the sheet ARRIVED + settled at `index`. A guaranteed settle-time backstop.
 *
 * These two predicates decide WHEN to collapse. `collapseToParent` is itself idempotent - it no-ops when
 * no detail is open, and while an in-progress flow kind (create-cleanup / edit-cleanup / composer, the
 * authoritative list being `nav/flowKinds`) sits anywhere on the stack - so the predicates only need to
 * answer "is the sheet heading to / resting at peek?", never "is there something to collapse?".
 */

/** Mid-collapse parent-swap point: the animated-index fraction past which the inline reaction fires. */
export const COLLAPSE_SWAP_AT = 0.7

/**
 * Arm the mid-animation parent-swap when the sheet commits to a transition. gorhom onAnimate(from, to).
 *
 * Gate on the DESTINATION (`to`) only, NOT the origin: an interrupted pull-up never settles, so a
 * subsequent pull-down reports `from` still 0 (gorhom's last-settled index). Requiring `from > 0` would
 * miss that collapse and strand the detail at peek. Arming on any commit-toward-peek is safe because the
 * reaction's `collapseToParent` no-ops when there is nothing to collapse.
 */
export function armCollapse(_fromIndex: number, toIndex: number): boolean {
  return toIndex === 0
}

/**
 * The settle-time backstop: collapse a stranded detail when the sheet arrives at peek. gorhom
 * onChange(index), with the previously-settled index.
 *
 * Gate on the arrival index ONLY, NOT the previous index: when a pull-up is interrupted before it settles,
 * the previously-settled index is still 0, so a `prev !== 0` guard would skip the collapse. Firing on every
 * settle-at-peek is safe (`collapseToParent` no-ops at home / mid-flow), and it GUARANTEES the revert even
 * when the smooth mid-animation path was never armed.
 */
export function shouldCollapseOnSettle(index: number, _prevIndex: number): boolean {
  return index === 0
}
