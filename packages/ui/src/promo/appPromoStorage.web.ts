/**
 * localStorage rather than a cookie like the sidebar width: the dismissal is a pure client-side
 * preference, and zustand's `persist` needs a synchronous storage. Every access degrades to a no-op
 * during the static-export build (no `window`) and in Safari private mode (access throws).
 */
import type { StateStorage } from "zustand/middleware"

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export const appPromoStorage: StateStorage = {
  getItem: (name) => {
    if (!available()) return null
    try {
      return window.localStorage.getItem(name)
    } catch {
      // Private mode / storage blocked: behave as "never dismissed".
      return null
    }
  },
  setItem: (name, value) => {
    if (!available()) return
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Storage blocked or quota exceeded: the dismissal still holds for this session, in memory.
    }
  },
  removeItem: (name) => {
    if (!available()) return
    try {
      window.localStorage.removeItem(name)
    } catch {
      // Storage blocked: there is nothing to remove.
    }
  },
}
