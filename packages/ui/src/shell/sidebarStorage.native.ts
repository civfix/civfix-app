/**
 * MMKV is a native module, so it is constructed lazily and a construction failure (an `expo export`
 * static eval) degrades to an in-memory Map so imports never crash.
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
    // Dedicated instance id so the sidebar width never collides with the app's other MMKV stores.
    return new MMKV({ id: "civfix.ui.sidebar" })
  } catch {
    // No native module (static export eval): degrade to a memory store so imports never crash.
    return memoryStore()
  }
}

const store: KV = createStore()

export const sidebarStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => store.delete(name),
}
