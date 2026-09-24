import { beforeEach, describe, expect, it } from "vitest"
import type { ReportCategory } from "@civfix/shared"
import {
  useReportFilterStore,
  enabledCategoriesArray,
  mergePersistedFilters,
  FILTER_CATEGORIES,
} from "../filterStore"

beforeEach(() => {
  useReportFilterStore.setState({
    enabled: new Set(),
    eventsEnabled: true,
    counts: null,
  })
})

describe("filterStore: defaults", () => {
  it("starts with ALL report categories shown on first run", () => {
    const initial = useReportFilterStore.getInitialState()
    expect(initial.enabled.size).toBe(FILTER_CATEGORIES.length)
    expect([...initial.enabled].sort()).toEqual([...FILTER_CATEGORIES].sort())
  })

  it("shows events by default", () => {
    expect(useReportFilterStore.getInitialState().eventsEnabled).toBe(true)
  })

  it("lists the six real categories (no 'other')", () => {
    expect([...FILTER_CATEGORIES]).not.toContain("other")
    expect([...FILTER_CATEGORIES]).toContain("encampment")
    expect(FILTER_CATEGORIES.length).toBe(6)
  })
})

describe("filterStore: category toggles", () => {
  it("toggle flips one category and assigns a NEW Set (reference changes)", () => {
    const before = useReportFilterStore.getState().enabled
    useReportFilterStore.getState().toggle("trash")
    const after = useReportFilterStore.getState().enabled
    expect(after).not.toBe(before)
    expect(after.has("trash")).toBe(true)

    useReportFilterStore.getState().toggle("trash")
    expect(useReportFilterStore.getState().enabled.has("trash")).toBe(false)
  })

  it("setAll selects every category; clearAll empties it", () => {
    useReportFilterStore.getState().setAll()
    expect(useReportFilterStore.getState().enabled.size).toBe(FILTER_CATEGORIES.length)

    useReportFilterStore.getState().clearAll()
    expect(useReportFilterStore.getState().enabled.size).toBe(0)
  })

  it("toggleAll selects all from empty, then clears all when full", () => {
    useReportFilterStore.getState().toggleAll()
    expect(useReportFilterStore.getState().enabled.size).toBe(FILTER_CATEGORIES.length)

    useReportFilterStore.getState().toggleAll()
    expect(useReportFilterStore.getState().enabled.size).toBe(0)
  })

  it("isEnabled reflects the current selection", () => {
    expect(useReportFilterStore.getState().isEnabled("water")).toBe(false)
    useReportFilterStore.getState().toggle("water")
    expect(useReportFilterStore.getState().isEnabled("water")).toBe(true)
  })
})

describe("filterStore: events layer", () => {
  it("toggleEvents hides then re-shows the events layer", () => {
    useReportFilterStore.getState().toggleEvents()
    expect(useReportFilterStore.getState().eventsEnabled).toBe(false)
    useReportFilterStore.getState().toggleEvents()
    expect(useReportFilterStore.getState().eventsEnabled).toBe(true)
  })

  it("toggling events leaves the report-category selection untouched", () => {
    useReportFilterStore.getState().setAll()
    useReportFilterStore.getState().toggleEvents()
    expect(useReportFilterStore.getState().enabled.size).toBe(FILTER_CATEGORIES.length)
  })
})

describe("filterStore: rehydrate merge (newly-introduced categories)", () => {
  const current = () => useReportFilterStore.getInitialState()

  it("keeps a category the user explicitly turned off", () => {
    const merged = mergePersistedFilters(
      {
        enabled: new Set<ReportCategory>(FILTER_CATEGORIES.filter((c) => c !== "graffiti")),
        eventsEnabled: true,
        knownCategories: [...FILTER_CATEGORIES],
      },
      current(),
    )
    expect(merged.enabled.has("graffiti")).toBe(false)
    expect(merged.enabled.size).toBe(FILTER_CATEGORIES.length - 1)
  })

  it("turns ON a category that did not exist when the selection was written", () => {
    const known = FILTER_CATEGORIES.filter((c) => c !== "encampment")
    const merged = mergePersistedFilters(
      {
        enabled: new Set<ReportCategory>(known.filter((c) => c !== "water")),
        eventsEnabled: false,
        knownCategories: [...known],
      },
      current(),
    )
    expect(merged.enabled.has("encampment")).toBe(true)
    expect(merged.enabled.has("water")).toBe(false)
    expect(merged.eventsEnabled).toBe(false)
  })

  it("keeps every already-live category off in a legacy payload (no knownCategories stamp)", () => {
    const merged = mergePersistedFilters(
      { enabled: new Set<ReportCategory>(["trash", "recycling"]), eventsEnabled: true },
      current(),
    )
    expect(merged.enabled.has("encampment")).toBe(false)
    expect(merged.enabled.has("graffiti")).toBe(false)
    expect([...merged.enabled].sort()).toEqual(["recycling", "trash"])
  })

  it("still defaults a genuinely-new category ON for a legacy payload", () => {
    const future = "compost" as ReportCategory
    const merged = mergePersistedFilters(
      { enabled: new Set<ReportCategory>(["trash"]), eventsEnabled: true },
      current(),
      [...FILTER_CATEGORIES, future],
    )
    expect(merged.enabled.has(future)).toBe(true)
    expect(merged.enabled.has("encampment")).toBe(false)
  })

  it("falls back to the defaults for a missing / unrevivable payload", () => {
    const merged = mergePersistedFilters(undefined, current())
    expect(merged.enabled.size).toBe(FILTER_CATEGORIES.length)
    expect(merged.eventsEnabled).toBe(true)
  })
})

describe("filterStore: corrupt persisted payloads never re-inject a non-Set enabled", () => {
  const current = () => useReportFilterStore.getInitialState()

  it("keeps the default Set when enabled was persisted as a plain array", () => {
    const merged = mergePersistedFilters(
      { enabled: ["trash", "water"], eventsEnabled: false },
      current(),
    )
    expect(merged.enabled).toBeInstanceOf(Set)
    expect(merged.enabled.size).toBe(FILTER_CATEGORIES.length)
    expect(merged.enabled.has("trash")).toBe(true)
    expect(merged.eventsEnabled).toBe(false)
  })

  it("keeps the default Set when enabled is a string", () => {
    const merged = mergePersistedFilters({ enabled: "trash" }, current())
    expect(merged.enabled).toBeInstanceOf(Set)
    expect(merged.enabled.size).toBe(FILTER_CATEGORIES.length)
  })

  it("keeps the default Set when enabled is undefined but other keys survive", () => {
    const merged = mergePersistedFilters({ eventsEnabled: false }, current())
    expect(merged.enabled).toBeInstanceOf(Set)
    expect(merged.eventsEnabled).toBe(false)
  })

  it("ignores a non-boolean eventsEnabled on the corrupt branch", () => {
    const merged = mergePersistedFilters({ enabled: ["trash"], eventsEnabled: "nope" }, current())
    expect(merged.enabled).toBeInstanceOf(Set)
    expect(merged.eventsEnabled).toBe(true)
  })

  it("never adopts corrupt keys wholesale onto the state", () => {
    const merged = mergePersistedFilters(
      { enabled: ["trash"], counts: "garbage", layersOpen: "yes" },
      current(),
    )
    expect(merged.counts).toBeNull()
    expect(merged.layersOpen).toBe(false)
  })

  it("yields the defaults for a version-mismatched payload, which zustand persist hands to merge as undefined when no migrate fn exists", () => {
    const merged = mergePersistedFilters(undefined, current())
    expect(merged.enabled).toBeInstanceOf(Set)
    expect(merged.enabled.size).toBe(FILTER_CATEGORIES.length)
    expect(merged.eventsEnabled).toBe(true)
  })
})

describe("filterStore: enabledCategoriesArray", () => {
  it("returns the enabled categories in canonical order", () => {
    useReportFilterStore.getState().toggle("water")
    useReportFilterStore.getState().toggle("trash")
    expect(enabledCategoriesArray(useReportFilterStore.getState().enabled)).toEqual(["trash", "water"])
  })

  it("is empty when nothing is enabled", () => {
    expect(enabledCategoriesArray(useReportFilterStore.getState().enabled)).toEqual([])
  })
})
