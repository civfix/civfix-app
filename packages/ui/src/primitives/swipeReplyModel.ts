import { startsInBackSwipeEdge } from "./backSwipeEdge"

export const SWIPE_CAPTURE_SLOP_PX = 10
export const SWIPE_TRIGGER_PX = 48
export const SWIPE_MAX_TRANSLATE_PX = 64

export function shouldCaptureSwipe(dx: number, dy: number, startX = Number.POSITIVE_INFINITY): boolean {
  if (startsInBackSwipeEdge(startX)) return false
  return dx > SWIPE_CAPTURE_SLOP_PX && dx > Math.abs(dy)
}

export function swipeTranslate(dx: number): number {
  return Math.max(0, Math.min(dx, SWIPE_MAX_TRANSLATE_PX))
}

export function swipeProgress(dx: number): number {
  return Math.max(0, Math.min(dx / SWIPE_TRIGGER_PX, 1))
}

export function shouldTriggerReply(dx: number): boolean {
  return dx >= SWIPE_TRIGGER_PX
}
