/**
 * The native-app download promo store (zustand + persist).
 *
 * ONE store backs BOTH promo surfaces (see
 * docs/superpowers/specs/2026-07-18-web-app-download-promo-design.md):
 *   - the fixed top banner in portrait (owned by civfix-web), and
 *   - the badge section at the bottom of the home side card in landscape (AppPromoCard, in this package).
 *
 * Sharing one store is what makes dismissal REACTIVE across the two: dismissing the banner in portrait
 * makes the side card section vanish on rotation without a reload. It also gives the banner a way to
 * publish its measured height across an AppShell slot boundary to web-map-controls, which folds it into
 * `MapControls topInset` so the glass control stack sits below the banner.
 *
 * State partition:
 *   - `dismissed`    PERSISTED. The user said "not interested"; never ask again on this browser.
 *   - `bannerHeight` EPHEMERAL. Persisting it would offset the map controls on a later load where no
 *                    banner renders at all (desktop, or after dismissal), pushing them down for nothing.
 *
 * Pure zustand + the storage seam: no next / expo / react-native, so it unit-tests directly under vitest.
 */
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { appPromoStorage } from "./appPromoStorage"

export interface AppPromoState {
  /** The user dismissed the promo (either surface). Persisted; permanent, no expiry. */
  dismissed: boolean
  /** Dismiss the promo everywhere, and drop both surface offsets in the same tick. */
  dismiss: () => void
  /** Measured height (px) of the live top banner; 0 when no banner is rendered. Ephemeral. */
  bannerHeight: number
  /** Publish the banner's measured height (rounded, floored at 0). */
  setBannerHeight: (height: number) => void
  /**
   * Measured height (px) of the live side-card footer; 0 when no card is rendered. Ephemeral.
   *
   * The card is an ABSOLUTE overlay pinned to the bottom of the landscape card, so it sits above the
   * scroll rather than inside it. FeedBody pads its list content by this height so the last real row can
   * still be scrolled clear of the overlay instead of being permanently hidden behind it.
   */
  cardHeight: number
  /** Publish the card footer's measured height (rounded, floored at 0). */
  setCardHeight: (height: number) => void
}

export const useAppPromoStore = create<AppPromoState>()(
  persist(
    (set) => ({
      dismissed: false,
      // Dismissing zeroes both heights in the SAME update: the surfaces unmount, so a stale height would
      // keep the map controls pushed down (banner) or the sidebar padded (card) for something that is no
      // longer there.
      dismiss: () => set({ dismissed: true, bannerHeight: 0, cardHeight: 0 }),
      bannerHeight: 0,
      setBannerHeight: (height) => set({ bannerHeight: Math.max(0, Math.round(height)) }),
      cardHeight: 0,
      setCardHeight: (height) => set({ cardHeight: Math.max(0, Math.round(height)) }),
    }),
    {
      // A synchronous storage => zustand hydrates during create, so the very first render already knows
      // the promo was dismissed (no flash of a banner the user already dismissed).
      name: "civfix.app-promo-dismissed",
      version: 1,
      storage: createJSONStorage(() => appPromoStorage),
      // Persist ONLY the dismissal (never the actions, never the ephemeral height).
      partialize: (state) => ({ dismissed: state.dismissed }),
    },
  ),
)
