import type { StateStorage } from "zustand/middleware"

// The promo never renders on native (useAppPromo only detects a platform on web), so its dismissal
// has nothing to remember there and the store opens no MMKV instance at launch for it.
const NOTHING_TO_PERSIST: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export function appPromoStorage(): StateStorage {
  return NOTHING_TO_PERSIST
}
