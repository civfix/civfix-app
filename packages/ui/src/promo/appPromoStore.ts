/**
 * One store backs both promo surfaces, the portrait top banner (in apps/community-web) and the landscape
 * side-card section (AppPromoCard), so dismissing one makes the other vanish on rotation without a
 * reload. It also carries the banner's measured height across an AppShell slot boundary so the web map
 * controls can sit below it.
 *
 * Only `dismissed` persists. A persisted height would push the map controls down on a later load where
 * no banner renders at all.
 */
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { appPromoStorage } from "./appPromoStorage"

export interface AppPromoState {
  dismissed: boolean
  dismiss: () => void
  bannerHeight: number
  setBannerHeight: (height: number) => void
  /**
   * The card is an absolute overlay pinned to the bottom of the landscape card, so FeedBody pads its list
   * by this height to keep the last row scrollable clear of it.
   */
  cardHeight: number
  setCardHeight: (height: number) => void
}

export const useAppPromoStore = create<AppPromoState>()(
  persist(
    (set) => ({
      dismissed: false,
      // Both heights zero in the same update: the surfaces unmount, and a stale height would keep the map
      // controls pushed down or the sidebar padded for something no longer there.
      dismiss: () => set({ dismissed: true, bannerHeight: 0, cardHeight: 0 }),
      bannerHeight: 0,
      setBannerHeight: (height) => set({ bannerHeight: Math.max(0, Math.round(height)) }),
      cardHeight: 0,
      setCardHeight: (height) => set({ cardHeight: Math.max(0, Math.round(height)) }),
    }),
    {
      // A synchronous storage hydrates during create, so the first render never flashes a dismissed banner.
      name: "civfix.app-promo-dismissed",
      version: 1,
      storage: createJSONStorage(() => appPromoStorage),
      partialize: (state) => ({ dismissed: state.dismissed }),
    },
  ),
)
