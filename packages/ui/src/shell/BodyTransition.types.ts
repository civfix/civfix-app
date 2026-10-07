/**
 * Props for the body-region transition wrapper. `direction` picks the animation for a `transitionKey`
 * change: "push" (the stack grew) slides the incoming body in from the right while the outgoing one
 * parallaxes left and dims; "pop" is the reverse; "replace" (a tab switch, home to list) cross-fades. The
 * native seam runs the same directions as a single-layer entrance animation.
 */
import type { ReactNode } from "react"

export type BodyTransitionDirection = "push" | "pop" | "replace"

export interface BodyTransitionProps {
  children: ReactNode
  /** A stable per-screen string (e.g. `pin:abc`, `view:events`); a change drives the animation. */
  transitionKey: string
  direction: BodyTransitionDirection
}
