/**
 * App-promo dismissal storage - NATIVE seam.
 *
 * Mirrors appPromoStorage.web.ts but backs the zustand `persist` StateStorage with MMKV, the same engine
 * filterStorage.native.ts / sidebarStorage.native.ts use. MMKV is a native module, so it is constructed
 * lazily and a construction failure (e.g. an `expo export` static eval with no native module) degrades to
 * an in-memory Map so imports never crash.
 *
 * In practice the promo never renders on native (it is gated on `Platform.OS === "web"` - you do not
 * advertise the app inside the app), so this seam exists purely so Metro can resolve the import.
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
    // Dedicated instance id so the promo flag never collides with the app's other MMKV stores.
    return new MMKV({ id: "civfix.ui.app-promo" })
  } catch {
    // No native module (static export eval): degrade to a memory store so imports never crash.
    return memoryStore()
  }
}

const store: KV = createStore()

export const appPromoStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => store.delete(name),
}
