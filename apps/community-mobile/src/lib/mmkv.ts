import { MMKV } from "react-native-mmkv"
import type { StateStorage } from "zustand/middleware"
import { API_URL } from "@/config"
import { scopeStorageId } from "@/lib/storageScope"

const INSTANCE_ID = scopeStorageId("civfix.app", API_URL)

export interface KeyValueStore {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

interface ClearableStore extends KeyValueStore {
  clearAll(): void
}

function memoryStore(): ClearableStore {
  const map = new Map<string, string>()
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
    },
    delete: (key) => {
      map.delete(key)
    },
    clearAll: () => map.clear(),
  }
}

function createStore(): ClearableStore {
  try {
    return new MMKV({ id: INSTANCE_ID })
  } catch {
    return memoryStore()
  }
}

const store = createStore()

export const storage: KeyValueStore = store

export function clearAppStorage(): void {
  try {
    store.clearAll()
  } catch {
    return
  }
}

export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
}
