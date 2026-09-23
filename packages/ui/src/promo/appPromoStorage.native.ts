/**
 * The promo never renders on native (you do not advertise the app inside the app); this seam exists so
 * Metro can resolve the import. MMKV is built lazily and falls back to memory when the native module is
 * missing, as in an `expo export` static evaluation, so importing never crashes.
 */
import { MMKV } from "react-native-mmkv"
import type { StateStorage } from "zustand/middleware"

interface KV {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

function memoryStore(): KV {
  const map = new Map<string, string>()
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
    },
    delete: (key) => {
      map.delete(key)
    },
  }
}

function createStore(): KV {
  try {
    // A dedicated instance id keeps the promo flag clear of the app's other MMKV stores.
    return new MMKV({ id: "civfix.ui.app-promo" })
  } catch {
    return memoryStore()
  }
}

const store: KV = createStore()

export const appPromoStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => store.delete(name),
}
