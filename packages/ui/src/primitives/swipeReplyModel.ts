/**
 * swipeReplyModel (P2 Task 2.8) - the pure math behind the native swipe-to-reply gesture, extracted
 * from useSwipeReply so the capture/threshold/clamp rules are unit-testable without react-native
 * (package convention: pure-logic vitest, like reactionChipModel / messageContextMenuLayout).
 *
 * Geometry: a RIGHT-only horizontal drag on a bubble row. The row translates with the finger up to
 * SWIPE_MAX_TRANSLATE_PX (hard clamp - the row never runs away), a reply hint fades in proportionally
 * to SWIPE_TRIGGER_PX, and releasing at/past SWIPE_TRIGGER_PX fires the reply action. Capture is
 * dx/dy-dominance gated so the vertical FlatList scroll always wins vertical-ish drags, and left
 * drags never capture at all (dx must be POSITIVE - there is no left-swipe affordance).
 */

import { startsInBackSwipeEdge } from "./backSwipeEdge"

/** Minimum rightward travel (px) before the gesture claims the responder (finger slop). */
export const SWIPE_CAPTURE_SLOP_PX = 10
/** Release at/past this rightward travel (px) triggers the reply action (and the haptic tick). */
export const SWIPE_TRIGGER_PX = 48
/** The row's translation is hard-clamped here (px) - drag past it adds no further movement. */
export const SWIPE_MAX_TRANSLATE_PX = 64

/**
 * Should a move event claim the pan responder? Right-only (dx > 0), past slop, and horizontally
 * dominant (|dx| > |dy|) so the list's vertical scroll keeps vertical-ish drags. Positive-dx checks
 * make the |dx| explicit-abs redundant on the dx side.
 */
export function shouldCaptureSwipe(dx: number, dy: number, startX = Number.POSITIVE_INFINITY): boolean {
  if (startsInBackSwipeEdge(startX)) return false
  return dx > SWIPE_CAPTURE_SLOP_PX && dx > Math.abs(dy)
}

/** The row's translateX for a given drag dx: follow the finger rightward, clamped [0, MAX]. */
export function swipeTranslate(dx: number): number {
  return Math.max(0, Math.min(dx, SWIPE_MAX_TRANSLATE_PX))
}

/** Hint opacity / progress toward the trigger threshold, clamped [0, 1]. */
export function swipeProgress(dx: number): number {
  return Math.max(0, Math.min(dx / SWIPE_TRIGGER_PX, 1))
}

/** Has the drag crossed the trigger threshold (release here = reply; first crossing = haptic tick)? */
export function shouldTriggerReply(dx: number): boolean {
  return dx >= SWIPE_TRIGGER_PX
}
