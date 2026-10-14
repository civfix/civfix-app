import { MMKV } from "react-native-mmkv"
import type { StateStorage } from "zustand/middleware"
import { API_URL } from "@/config"
import { scopeStorageId } from "@/lib/storageScope"
import { memoryKeyValueStore, type ClearableKeyValueStore } from "@/lib/memoryKeyValueStore"

const INSTANCE_ID = scopeStorageId("civfix.app", API_URL)

export interface KeyValueStore {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

function createStore(): ClearableKeyValueStore {
  try {
    return new MMKV({ id: INSTANCE_ID })
  } catch {
    return memoryKeyValueStore()
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
