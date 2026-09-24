import { SWIPE_CAPTURE_SLOP_PX, startsInBackSwipeEdge } from "./backSwipeEdge"

export const SWIPE_ACTION_WIDTH_PX = 72
export const SWIPE_ACTIONS_SNAP_RATIO = 0.5
export const SWIPE_ACTIONS_FLING_VX = 0.35

export function actionsWidth(count: number): number {
  return count > 0 ? count * SWIPE_ACTION_WIDTH_PX : 0
}

export function actionsRestingX(open: boolean, width: number): number {
  return open ? -width : 0
}

export function shouldCaptureActionsSwipe(
  dx: number,
  dy: number,
  open: boolean,
  startX = Number.POSITIVE_INFINITY,
): boolean {
  if (Math.abs(dx) <= SWIPE_CAPTURE_SLOP_PX) return false
  if (Math.abs(dx) <= Math.abs(dy)) return false
  if (dx < 0) return true
  return open && !startsInBackSwipeEdge(startX)
}

export function actionsTranslate(dx: number, restX: number, width: number): number {
  return Math.max(-width, Math.min(0, restX + dx))
}

export function actionsProgress(translate: number, width: number): number {
  if (width <= 0) return 0
  return Math.max(0, Math.min(1, -translate / width))
}

export function shouldSnapOpen(translate: number, width: number, vx: number): boolean {
  if (width <= 0) return false
  if (vx <= -SWIPE_ACTIONS_FLING_VX) return true
  if (vx >= SWIPE_ACTIONS_FLING_VX) return false
  return translate <= -width * SWIPE_ACTIONS_SNAP_RATIO
}
