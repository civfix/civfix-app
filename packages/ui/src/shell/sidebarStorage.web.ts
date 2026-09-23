/**
 * Cookies rather than localStorage per the product ask, so the preference rides along with the document.
 * Guarded for the static-export prerender (no `document`), where it degrades to a no-op.
 */
import type { StateStorage } from "zustand/middleware"

const MAX_AGE_SEC = 60 * 60 * 24 * 365

function available(): boolean {
  return typeof document !== "undefined"
}

export const sidebarStorage: StateStorage = {
  getItem: (name) => {
    if (!available()) return null
    try {
      const prefix = `${encodeURIComponent(name)}=`
      const hit = document.cookie.split("; ").find((c) => c.startsWith(prefix))
      return hit ? decodeURIComponent(hit.slice(prefix.length)) : null
    } catch {
      // Cookies blocked: behave as "no persisted value".
      return null
    }
  },
  setItem: (name, value) => {
    if (!available()) return
    try {
      document.cookie =
        `${encodeURIComponent(name)}=${encodeURIComponent(value)};` +
        ` path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`
    } catch {
      // Cookies blocked: skip the write (the in-memory width still works this session).
    }
  },
  removeItem: (name) => {
    if (!available()) return
    try {
      document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`
    } catch {
      // Cookies blocked: there is nothing to remove.
    }
  },
}
