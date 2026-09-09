/**
 * Native-app download promo (web-only surfaces).
 *
 * See docs/superpowers/specs/2026-07-18-web-app-download-promo-design.md. The card surface is mounted by
 * the landscape shell in its home slot (ExpandedShell); the portrait banner surface is owned by
 * civfix-web, which imports
 * `useAppPromo` + `storeLinksFor` from this barrel so both surfaces share one decision and one store.
 */
export { useAppPromo } from "./useAppPromo"
export type { AppPromo } from "./useAppPromo"
export { AppPromoCard } from "./AppPromoCard"
export { useAppPromoStore } from "./appPromoStore"
export type { AppPromoState } from "./appPromoStore"
export { detectAppPlatform, isStandalonePWA, storeLinksFor } from "./platform"
export type { AppPlatform, AppStore, StoreLink, PlatformProbe } from "./platform"
export { appPromoSurface } from "./visibility"
export type { AppPromoInput, AppPromoSurface } from "./visibility"
