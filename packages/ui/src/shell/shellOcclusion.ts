import { useNavStore } from "../nav"
import { expandedFramePlan } from "./expandedFramePlan"
import { clampSidebarWidth, useSidebarStore } from "./sidebarStore"

/**
 * The px the rail and card cover on the map's left edge in landscape. It reads the stores at call time, so
 * a caller that has just pushed onto the nav stack sees the card it brought back.
 */
export function shellOcclusionLeft(windowWidth: number): number {
  return expandedFramePlan({
    view: useNavStore.getState().view,
    stackLength: useNavStore.getState().stack.length,
    sidebarWidth: clampSidebarWidth(useSidebarStore.getState().width, windowWidth),
  }).occlusionLeft
}
