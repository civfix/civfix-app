import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { ReportCategorySchema, type ReportCategory } from "@civfix/shared"
import { persistentStorage } from "../storage/persistentStorage"
import { MAP_FILTERS_STORAGE_ID } from "../storage/storageIds"

export const FILTER_CATEGORIES: readonly ReportCategory[] = ReportCategorySchema.options.filter(
  (c) => c !== "other",
)

const LEGACY_KNOWN_CATEGORIES: readonly ReportCategory[] = [
  "trash",
  "recycling",
  "graffiti",
  "hazard",
  "water",
  "encampment",
]

export interface PersistedFilterState {
  enabled: Set<ReportCategory>
  eventsEnabled: boolean
  knownCategories?: ReportCategory[]
}

export interface ReportFilterState {
  enabled: Set<ReportCategory>
  eventsEnabled: boolean
  counts: Partial<Record<ReportCategory, number>> | null
  layersOpen: boolean

  toggle: (category: ReportCategory) => void
  toggleEvents: () => void
  setAll: () => void
  clearAll: () => void
  toggleAll: () => void
  isEnabled: (category: ReportCategory) => boolean
  setCounts: (counts: Partial<Record<ReportCategory, number>> | null) => void
  setLayersOpen: (open: boolean) => void
}

export function mergePersistedFilters(
  persisted: unknown,
  current: ReportFilterState,
  categories: readonly ReportCategory[] = FILTER_CATEGORIES,
): ReportFilterState {
  const saved = (persisted ?? {}) as Partial<PersistedFilterState>
  if (!(saved.enabled instanceof Set)) {
    return {
      ...current,
      eventsEnabled:
        typeof saved.eventsEnabled === "boolean" ? saved.eventsEnabled : current.eventsEnabled,
    }
  }
  const known = new Set<ReportCategory>(saved.knownCategories ?? LEGACY_KNOWN_CATEGORIES)
  const enabled = new Set<ReportCategory>(saved.enabled)
  for (const c of categories) if (!known.has(c)) enabled.add(c)
  return { ...current, enabled, eventsEnabled: saved.eventsEnabled ?? current.eventsEnabled }
}

export const useReportFilterStore = create<ReportFilterState>()(
  persist(
    (set, get) => ({
      enabled: new Set<ReportCategory>(FILTER_CATEGORIES),
      eventsEnabled: true,
      counts: null,
      layersOpen: false,

      toggleEvents: () => set((state) => ({ eventsEnabled: !state.eventsEnabled })),

      toggle: (category) =>
        set((state) => {
          const next = new Set(state.enabled)
          if (next.has(category)) next.delete(category)
          else next.add(category)
          return { enabled: next }
        }),

      setAll: () => set({ enabled: new Set<ReportCategory>(FILTER_CATEGORIES) }),

      clearAll: () => set({ enabled: new Set<ReportCategory>() }),

      toggleAll: () =>
        set((state) => ({
          enabled:
            state.enabled.size === FILTER_CATEGORIES.length
              ? new Set<ReportCategory>()
              : new Set<ReportCategory>(FILTER_CATEGORIES),
        })),

      isEnabled: (category) => get().enabled.has(category),

      setCounts: (counts) => set({ counts }),

      setLayersOpen: (open) => set({ layersOpen: open }),
    }),
    {
      name: "civfix.map-filters",
      version: 1,
      storage: createJSONStorage(() => persistentStorage(MAP_FILTERS_STORAGE_ID), {
        replacer: (_key, value) => (value instanceof Set ? { __set: [...value] } : value),
        reviver: (_key, value) => {
          if (value && typeof value === "object" && Array.isArray((value as { __set?: unknown }).__set)) {
            return new Set((value as { __set: ReportCategory[] }).__set)
          }
          return value
        },
      }),
      partialize: (state): PersistedFilterState => ({
        enabled: new Set<ReportCategory>(FILTER_CATEGORIES.filter((c) => state.enabled.has(c))),
        eventsEnabled: state.eventsEnabled,
        knownCategories: [...FILTER_CATEGORIES],
      }),
      merge: (persisted, current) => mergePersistedFilters(persisted, current),
    },
  ),
)

export function enabledCategoriesArray(enabled: Set<ReportCategory>): ReportCategory[] {
  return FILTER_CATEGORIES.filter((c) => enabled.has(c))
}
