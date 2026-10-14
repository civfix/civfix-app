import type { KeyValueStore } from "@/lib/mmkv"

export interface ClearableKeyValueStore extends KeyValueStore {
  clearAll(): void
}

export function memoryKeyValueStore(): ClearableKeyValueStore {
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
