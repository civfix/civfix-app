/**
 * The landscape sidebar width, persisted through the platform seam (cookies on web, MMKV on native) so a
 * drag-resize survives a reload. Pure zustand plus the storage seam, so it unit-tests under vitest.
 */
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { sidebarStorage } from "./sidebarStorage"
import { MAP_MIN_CLEAR, NAV_LEFT } from "./expandedFramePlan"

/**
 * 440 - 32 (the row's horizontal inset) - 52 (avatar 40 + gutter 12) = 356px, about 46ch of Hanken 15 for
 * a `PostCard` row; 384 gave about 38ch, which reads cramped for a feed.
 */
export const SIDEBAR_DEFAULT_WIDTH = 440
/** The only stored value the v2 migration rewrites: a hand-chosen width is the user's. */
export const LEGACY_DEFAULT_WIDTH = 384
export const SIDEBAR_MIN_WIDTH = 300
export const SIDEBAR_MAX_WIDTH = 640

/**
 * The map must always keep MAP_MIN_CLEAR px beside the card. The cap spends only `NAV_LEFT`: the nav strip
 * is a top bar and costs the map no horizontal space.
 */
export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - NAV_LEFT - MAP_MIN_CLEAR)
  // On a viewport too small for the min, the min collapses to max so the card never eats the map strip.
  const min = Math.min(SIDEBAR_MIN_WIDTH, max)
  return Math.round(Math.min(Math.max(width, min), max))
}

/**
 * A missing or non-numeric value degrades to the default rather than poisoning the store with `undefined`,
 * because zustand shallow-merges the migration's result over the initial state.
 */
export function migrateSidebarWidth(persisted: unknown): { width: number } {
  const stored = (persisted as { width?: unknown } | null | undefined)?.width
  if (typeof stored !== "number" || !Number.isFinite(stored)) return { width: SIDEBAR_DEFAULT_WIDTH }
  return { width: stored === LEGACY_DEFAULT_WIDTH ? SIDEBAR_DEFAULT_WIDTH : stored }
}

export interface SidebarState {
  width: number
  setWidth: (width: number) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      width: SIDEBAR_DEFAULT_WIDTH,
      setWidth: (width) =>
        set({
          // The SAME absolute band `clampSidebarWidth` enforces. A second, tighter cap here would silently
          // no-op any raise of SIDEBAR_MAX_WIDTH, since every drag commits through this write.
          width: Math.round(Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)),
        }),
    }),
    {
      // Synchronous storage lets zustand hydrate during create, so the first render has the saved width.
      name: "civfix.sidebar-width",
      version: 2,
      migrate: migrateSidebarWidth,
      storage: createJSONStorage(() => sidebarStorage),
      partialize: (state) => ({ width: state.width }),
    },
  ),
)
