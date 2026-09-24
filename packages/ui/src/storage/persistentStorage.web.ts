/**
 * zustand `persist` needs a synchronous StateStorage; the `window` guard lets the Next static-export build
 * degrade to a no-op instead of throwing.
 */
import type { StateStorage } from "zustand/middleware"

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export const persistentStorage: StateStorage = {
  getItem: (name) => {
    if (!available()) return null
    try {
      return window.localStorage.getItem(name)
    } catch {
      // SecurityError in private mode reads as no persisted value.
      return null
    }
  },
  setItem: (name, value) => {
    if (!available()) return
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Full or blocked storage: the in-memory selection still works this session.
    }
  },
  removeItem: (name) => {
    if (!available()) return
    try {
      window.localStorage.removeItem(name)
    } catch {
      // Best effort.
    }
  },
}
