import type { LayoutMode, View } from "@civfix/ui"

export interface MobileHostMapPlan {
  renderMapControls: boolean
}

export function mobileHostMapPlan(layoutMode: LayoutMode, view: View): MobileHostMapPlan {
  return { renderMapControls: layoutMode === "expanded" || view === "map" }
}
