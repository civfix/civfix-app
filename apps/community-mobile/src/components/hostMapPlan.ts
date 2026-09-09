import type { LayoutMode, View } from "@civfix/ui"

export interface MobileHostMapPlan {
  renderMap: boolean
  renderMapControls: boolean
}

export function mobileHostMapPlan(layoutMode: LayoutMode, view: View): MobileHostMapPlan {
  const renderMap = true
  const renderMapControls = layoutMode === "expanded" || view === "map"
  return { renderMap, renderMapControls }
}
