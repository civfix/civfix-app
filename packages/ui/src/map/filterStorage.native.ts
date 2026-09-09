/**
 * Filter-store persistence storage - NATIVE seam.
 *
 * Mirrors filterStorage.web.ts but backs the zustand `persist` StateStorage with MMKV (synchronous
 * on-device key/value, the same engine the mobile app already uses for its query cache). MMKV is a native
 * module, so we construct it lazily and tolerate a construction failure (e.g. an `expo export` static eval
 * with no native module) by degrading to an in-memory Map - exactly like the mobile app's own
 * src/lib/mmkv.ts. Metro resolves `./filterStorage` to THIS file on native; web never bundles it.
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
    // Dedicated instance id so the filter prefs never collide with the app's other MMKV stores.
    return new MMKV({ id: "civfix.ui.filters" })
  } catch {
    // No native module (static export eval): degrade to a memory store so imports never crash.
    return memoryStore()
  }
}

const store: KV = createStore()

export const mapFilterStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => store.delete(name),
}
