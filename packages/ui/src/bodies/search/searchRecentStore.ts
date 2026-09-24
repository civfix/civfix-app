import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { persistentStorage } from "../../storage/persistentStorage"
import { MAP_FILTERS_STORAGE_ID } from "../../storage/storageIds"

export const SEARCH_RECENT_STORAGE_KEY = "civfix.search-recents"
export const SEARCH_RECENT_LIMIT = 6
export const SEARCH_RECENT_MIN_LENGTH = 2

export type SearchBodyMode = "resting" | "results"

export function getSearchBodyMode(query: string): SearchBodyMode {
  return query.trim() ? "results" : "resting"
}

export interface SearchRecentState {
  recent: string[]
  record: (query: string) => void
  clear: () => void
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ")
}

export function searchRecentCommit(query: string): string | null {
  const normalized = normalizeQuery(query)
  return normalized.length >= SEARCH_RECENT_MIN_LENGTH ? normalized : null
}

let searchInput = ""

export function trackSearchInput(query: string): void {
  if (query) searchInput = query
}

export function discardSearchInput(): void {
  searchInput = ""
}

export function pendingSearchInput(): string {
  return searchInput
}

function queryKey(query: string): string {
  return query.toLocaleLowerCase()
}

export const useSearchRecentStore = create<SearchRecentState>()(
  persist(
    (set) => ({
      recent: [],
      record: (query) => {
        const normalized = normalizeQuery(query)
        if (!normalized) return

        set((state) => ({
          recent: [normalized, ...state.recent.filter((item) => queryKey(item) !== queryKey(normalized))].slice(
            0,
            SEARCH_RECENT_LIMIT,
          ),
        }))
      },
      clear: () => set({ recent: [] }),
    }),
    {
      name: SEARCH_RECENT_STORAGE_KEY,
      storage: createJSONStorage(() => persistentStorage(MAP_FILTERS_STORAGE_ID)),
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
)
