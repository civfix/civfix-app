/**
 * Shared derivation of the <BodyTransition> `direction` from the nav stack length across renders.
 *
 * Originally inlined in ExpandedShell (issue #60); now that BOTH compact shells animate their body
 * swaps too, the three shells share this one derivation:
 *   - stack longer than last render  => a detail opened ("push")  - slide in from the right.
 *   - stack shorter than last render => Back / clear ("pop")      - slide in from the left.
 *   - unchanged length               => a lateral swap ("replace") - tab switch, home<->list, or a
 *     compact `openDetail` pin->pin replacement - plain cross-fade, no slide.
 *
 * `push` APPENDS and `back` POPS in both modes, so stack length is the reliable push/pop signal;
 * `openDetail` REPLACES the stack with one entry, so pin-after-pin lateral browsing keeps length 1
 * (=> "replace"), which is exactly the non-hierarchical cross-fade we want for it.
 */
import { useLayoutEffect, useRef } from "react"
import type { BodyTransitionDirection } from "./BodyTransition.types"

/** Pure predicate: the transition direction for a stack-length change (unit-tested directly). */
export function directionForStackLengths(prevLen: number, nextLen: number): BodyTransitionDirection {
  if (nextLen > prevLen) return "push"
  if (nextLen < prevLen) return "pop"
  return "replace"
}

/**
 * Track the stack length across renders and return the direction of the LATEST change. Must be called
 * unconditionally (it is a hook); the returned value is only meaningful on the render where the
 * transitionKey actually changed - BodyTransition reads it at that moment.
 *
 * The previous length advances in a COMMIT effect, never in the render body. A render-phase ref
 * mutation is not commit-safe: React may render a component more than once per commit (StrictMode's
 * development double-render) or start a render it then throws away (concurrent interruption), and each
 * of those extra render passes would advance the ref - so the pass that actually commits would compare
 * the length against ITSELF and report "replace" for every navigation (cross-fade where a push/pop
 * slide belongs), or a later unrelated re-render would replay a stale push/pop. Reading the ref in
 * render and writing it in `useLayoutEffect` makes the advance happen exactly once per COMMIT, which is
 * the cadence the direction is defined against. (Layout, not passive: it lands synchronously after the
 * commit, before any subsequent render can read the ref. Child layout effects - BodyTransition's own
 * key-change trigger - run BEFORE this one, and they read `direction` from props anyway, so the
 * ordering is immaterial to them.)
 */
export function useStackDirection(stackLength: number): BodyTransitionDirection {
  const prevLenRef = useRef(stackLength)
  const direction = directionForStackLengths(prevLenRef.current, stackLength)
  useLayoutEffect(() => {
    prevLenRef.current = stackLength
  }, [stackLength])
  return direction
}
