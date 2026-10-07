// Web-only surfaces: the landscape shell mounts the card, and apps/community-web owns the portrait banner
// through `useAppPromo` and `useAppPromoStore`, so both share one decision and one store.
export { useAppPromo } from "./useAppPromo"
export type { AppPromo } from "./useAppPromo"
export { AppPromoCard } from "./AppPromoCard"
export { useAppPromoStore } from "./appPromoStore"
export type { AppPromoState } from "./appPromoStore"
export type { AppPlatform, AppStore, StoreLink } from "./platform"
export type { AppPromoSurface } from "./visibility"
