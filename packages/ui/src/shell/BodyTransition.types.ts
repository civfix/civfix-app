/**
 * Shared props for the body-region transition wrapper (issue #60).
 *
 * The wrapper animates the swap between two body nodes in the EXPANDED (desktop-web) shell:
 *   - `transitionKey` identifies the currently-shown body. When it changes, the wrapper runs an
 *     animation FROM the previously-shown child TO the new `children`. Derive it from the active nav
 *     entry (e.g. `pin:abc`) or the list view (`view:events`) / `home` - any stable per-screen string.
 *   - `direction` tells the wrapper WHICH animation to run for that change:
 *       - "push"    : a detail opened (the stack grew) - incoming slides in from the right while the
 *                     outgoing screen parallaxes left + dims (iOS push).
 *       - "pop"     : Back (the stack shrank) - the reverse: incoming slides in from the left (un-dims)
 *                     while the outgoing screen slides out to the right.
 *       - "replace" : a non-hierarchical swap (tab switch, home<->list) - a plain cross-fade, no slide.
 *
 * The native seam (BodyTransition.native.tsx) implements the same directions as a single-layer
 * ENTRANCE animation (RN Animated; no outgoing clone layer - see its module doc for why), so BOTH
 * platforms now animate body swaps in the compact AND expanded shells.
 */
import type { ReactNode } from "react"

/** The kind of swap to animate. See the module doc for the per-direction motion. */
export type BodyTransitionDirection = "push" | "pop" | "replace"

export interface BodyTransitionProps {
  /** The body node to show for the current screen. */
  children: ReactNode
  /** A stable per-screen identifier; a change drives the animation from the previous child to this one. */
  transitionKey: string
  /** Which animation to run when `transitionKey` changes (hierarchical push/pop vs. cross-fade replace). */
  direction: BodyTransitionDirection
}
