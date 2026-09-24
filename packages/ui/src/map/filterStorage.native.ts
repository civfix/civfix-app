/**
 * MMKV is a native module, so construction is tolerated failing (an `expo export` static eval) by
 * degrading to an in-memory map, as the mobile app's own src/lib/mmkv.ts does.
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
    return new MMKV({ id: "civfix.ui.filters" })
  } catch {
    // No native module during an `expo export` static eval.
    return memoryStore()
  }
}

const store: KV = createStore()

export const mapFilterStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => store.delete(name),
}
