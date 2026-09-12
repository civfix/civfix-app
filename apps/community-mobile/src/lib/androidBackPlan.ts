import type { DetailEntry, View } from "@civfix/ui"

export type AndroidBackAction = "close-layers" | "pop-detail" | "leave-report" | "system"

export interface AndroidBackInput {
  layersOpen: boolean
  active: DetailEntry | null
  view: View
}

export function androidBackPlan({ layersOpen, active, view }: AndroidBackInput): AndroidBackAction {
  if (layersOpen) return "close-layers"
  if (active !== null) return "pop-detail"
  if (view === "report") return "leave-report"
  return "system"
}
