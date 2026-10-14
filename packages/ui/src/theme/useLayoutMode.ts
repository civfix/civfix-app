// A landscape (or square) window at least EXPANDED_MIN_WIDTH wide gets the expanded presentation; every
// other window, including a landscape one too narrow for the nav cluster, gets compact. Built on
// useWindowDimensions, so rotation and resize flip it on both platforms with no platform branch.
import { useWindowDimensions } from "react-native"
import type { LayoutMode } from "../nav/types"
import { layoutModeFor } from "../shell/expandedFramePlan"

export type { LayoutMode }

export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions()
  return layoutModeFor(width, height)
}
