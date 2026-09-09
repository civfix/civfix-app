/**
 * The landscape sidebar width store (zustand + persist).
 *
 * Holds the user's chosen width for the expanded-shell sidebar card so a drag-resize survives a reload /
 * app restart. Persisted through the platform seam (./sidebarStorage): COOKIES on web (the product ask),
 * MMKV on native. Only the chosen `width` is persisted; it is clamped to sane absolute bounds on write, and
 * the shell additionally clamps it to the live viewport at render (clampSidebarWidth) so the card never
 * exceeds the screen.
 *
 * Pure zustand + the storage seam: no next / expo / react-native, so it unit-tests directly under vitest.
 */
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { sidebarStorage } from "./sidebarStorage"
import { MAP_MIN_CLEAR, NAV_LEFT } from "./expandedFramePlan"

/**
 * The default sidebar width - the starting width before any user resize.
 *
 * WHY 440 and not the old 384: the card's home is a `PostCard` timeline now, and the honest readable-measure
 * math is 440 - 32 (the row's horizontal inset) - 52 (avatar 40 + gutter 12) = 356px, about 46ch of Hanken
 * 15. At 384 the same measure is ~38ch, which reads visibly cramped for a feed. (Two-up media tiles land at
 * 174px.) A stored 384 is migrated to this once - see `migrateSidebarWidth`.
 */
export const SIDEBAR_DEFAULT_WIDTH = 440
/** The v1 default. The ONLY stored value the v2 migration rewrites - a hand-chosen width is the user's. */
export const LEGACY_DEFAULT_WIDTH = 384
/** Narrowest the user may drag the sidebar (a feed row still reads at phone width). */
export const SIDEBAR_MIN_WIDTH = 300
/** Widest the user may drag the sidebar (a roomy reading column without swallowing the whole map). */
export const SIDEBAR_MAX_WIDTH = 640

/**
 * Clamp a desired width to what the LIVE viewport can show: never wider than SIDEBAR_MAX_WIDTH, never so
 * wide that the map loses its guaranteed strip (the card's own left inset plus the card must leave
 * MAP_MIN_CLEAR px of clear map), and never below SIDEBAR_MIN_WIDTH unless even the min cannot fit (a
 * viewport too narrow to be a real landscape), in which case it collapses to the available max so the card
 * still respects the guarantee. Returns a rounded integer px.
 *
 * The viewport cap spends the card's own `NAV_LEFT` inset, not a rail footprint: the top nav strip is a
 * horizontal bar now, so it costs the map no horizontal space of its own - only the card's left edge and
 * its live width do - and the map is a co-star rather than a backdrop, so the budget the clamp spends is
 * the map's minimum rather than a cosmetic inset.
 */
export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - NAV_LEFT - MAP_MIN_CLEAR)
  // On a viewport too small for the min, the min collapses to max so the card never eats the map strip.
  const min = Math.min(SIDEBAR_MIN_WIDTH, max)
  return Math.round(Math.min(Math.max(width, min), max))
}

/**
 * The persisted-state v1 -> v2 migration. It rewrites ONLY the exact old default (384) to the new one, so a
 * user who never touched the handle gets the redesign's measure while anyone who DID drag the card keeps the
 * width they chose. A missing / non-numeric persisted value degrades to the default rather than poisoning
 * the store with `undefined` (zustand shallow-merges the migration's result over the initial state).
 */
export function migrateSidebarWidth(persisted: unknown): { width: number } {
  const stored = (persisted as { width?: unknown } | null | undefined)?.width
  if (typeof stored !== "number" || !Number.isFinite(stored)) return { width: SIDEBAR_DEFAULT_WIDTH }
  return { width: stored === LEGACY_DEFAULT_WIDTH ? SIDEBAR_DEFAULT_WIDTH : stored }
}

export interface SidebarState {
  /** The user's chosen sidebar width (px), clamped to [SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH] on write. */
  width: number
  /** Persist a new chosen width (clamped to the absolute bounds; the shell re-clamps to the viewport). */
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
      // Persisted to the platform seam (cookies on web, MMKV on native) so the chosen width survives a
      // reload / app restart. A synchronous storage => zustand hydrates during create, so the very first
      // render already has the persisted width (no default-to-saved flash).
      name: "civfix.sidebar-width",
      version: 2,
      migrate: migrateSidebarWidth,
      storage: createJSONStorage(() => sidebarStorage),
      // Persist ONLY the chosen width (never the action).
      partialize: (state) => ({ width: state.width }),
    },
  ),
)
