import { MOTION } from "../theme/motion"

export const BACK_SWIPE_EDGE_PX = MOTION.pageEdgeWidth

export const SWIPE_CAPTURE_SLOP_PX = 10

export function startsInBackSwipeEdge(startX: number): boolean {
  return Number.isFinite(startX) && startX <= BACK_SWIPE_EDGE_PX
}
