import { MMKV } from "react-native-mmkv"
import type { StateStorage } from "zustand/middleware"

export interface KeyValueStore {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

function memoryStore(): KeyValueStore {
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

function createStore(): KeyValueStore {
  try {
    return new MMKV({ id: "civfix.app" })
  } catch {
    return memoryStore()
  }
}

export const storage: KeyValueStore = createStore()

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
}
