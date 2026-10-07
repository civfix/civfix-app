import type { StateStorage } from "zustand/middleware"
import { persistentStorage } from "../storage/persistentStorage"
import { APP_PROMO_STORAGE_ID } from "../storage/storageIds"

export function appPromoStorage(): StateStorage {
  return persistentStorage(APP_PROMO_STORAGE_ID)
}
