import { MOTION } from "../theme/motion"

export const BACK_SWIPE_EDGE_PX = MOTION.pageEdgeWidth

export function startsInBackSwipeEdge(startX: number): boolean {
  return Number.isFinite(startX) && startX <= BACK_SWIPE_EDGE_PX
}
