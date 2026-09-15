import { beforeEach, describe, expect, it } from "vitest"
import { ReportCategorySchema } from "@civfix/shared"
import {
  PICKER_CATEGORIES,
  allPickerCategories,
  toggledCategories,
  useReportPickerFilters,
} from "../reportPickerFilterStore"

describe("report picker filters", () => {
  beforeEach(() => useReportPickerFilters.getState().reset())

  it("offers every report category including other, all on by default", () => {
    expect([...PICKER_CATEGORIES]).toEqual([...ReportCategorySchema.options])
    expect(PICKER_CATEGORIES).toContain("other")
    expect(useReportPickerFilters.getState().enabled).toEqual(allPickerCategories())
    expect(useReportPickerFilters.getState().nearbyOnly).toBe(false)
  })

  it("toggles one layer, clears and restores all, and remembers nearby-only", () => {
    const store = useReportPickerFilters.getState()
    store.toggle("trash")
    expect(useReportPickerFilters.getState().enabled.has("trash")).toBe(false)
    store.toggle("trash")
    expect(useReportPickerFilters.getState().enabled.has("trash")).toBe(true)
    store.clearAll()
    expect(useReportPickerFilters.getState().enabled.size).toBe(0)
    store.setAll()
    expect(useReportPickerFilters.getState().enabled.size).toBe(PICKER_CATEGORIES.length)
    store.setNearbyOnly(true)
    expect(useReportPickerFilters.getState().nearbyOnly).toBe(true)
  })

  it("toggledCategories never mutates its input", () => {
    const input = new Set(allPickerCategories())
    const out = toggledCategories(input, "hazard")
    expect(input.has("hazard")).toBe(true)
    expect(out.has("hazard")).toBe(false)
  })
})
