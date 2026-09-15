import { create } from "zustand"
import { ReportCategorySchema, type ReportCategory } from "@civfix/shared"

export const PICKER_CATEGORIES: readonly ReportCategory[] = ReportCategorySchema.options

export interface ReportPickerFilterState {
  enabled: Set<ReportCategory>
  nearbyOnly: boolean
  toggle: (category: ReportCategory) => void
  setAll: () => void
  clearAll: () => void
  setNearbyOnly: (on: boolean) => void
  reset: () => void
}

export function allPickerCategories(): Set<ReportCategory> {
  return new Set<ReportCategory>(PICKER_CATEGORIES)
}

export function toggledCategories(
  enabled: ReadonlySet<ReportCategory>,
  category: ReportCategory,
): Set<ReportCategory> {
  const next = new Set(enabled)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  return next
}

export const useReportPickerFilters = create<ReportPickerFilterState>((set) => ({
  enabled: allPickerCategories(),
  nearbyOnly: false,
  toggle: (category) => set((state) => ({ enabled: toggledCategories(state.enabled, category) })),
  setAll: () => set({ enabled: allPickerCategories() }),
  clearAll: () => set({ enabled: new Set<ReportCategory>() }),
  setNearbyOnly: (on) => set({ nearbyOnly: on }),
  reset: () => set({ enabled: allPickerCategories(), nearbyOnly: false }),
}))
