/**
 * MMKV is a native module, so construction is tolerated failing (an `expo export` static eval) by
 * degrading to an in-memory map, as the mobile app's own src/lib/mmkv.ts does.
 */
import { MMKV } from "react-native-mmkv"
import type { StateStorage } from "zustand/middleware"
import { PERSISTENT_STORAGE_IDS } from "./storageIds"

interface KV {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
  clearAll(): void
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
    clearAll: () => {
      map.clear()
    },
  }
}

function openStore(id: string): KV {
  try {
    return new MMKV({ id })
  } catch {
    return memoryStore()
  }
}

// Stores that share an id share one instance, so a memory fallback is one map rather than one per caller.
const stores = new Map<string, KV>()
const storages = new Map<string, StateStorage>()

function storeFor(id: string): KV {
  const existing = stores.get(id)
  if (existing) return existing
  const store = openStore(id)
  stores.set(id, store)
  return store
}

export function persistentStorage(id: string): StateStorage {
  const existing = storages.get(id)
  if (existing) return existing
  const store = storeFor(id)
  const storage: StateStorage = {
    getItem: (name) => store.getString(name) ?? null,
    setItem: (name, value) => store.set(name, value),
    removeItem: (name) => store.delete(name),
  }
  storages.set(id, storage)
  return storage
}

// Every id, not only the ones opened this session: a store opens its instance lazily, on first use.
export function clearPersistentStorage(): void {
  for (const id of PERSISTENT_STORAGE_IDS) storeFor(id).clearAll()
}
