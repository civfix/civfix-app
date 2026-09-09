/**
 * Sidebar-width persistence storage - WEB seam (COOKIES).
 *
 * The landscape sidebar's user-chosen width (./sidebarStore) persists via zustand's `persist` middleware,
 * which needs a synchronous `StateStorage`. Per the product ask this uses COOKIES (not localStorage) so the
 * preference rides along with the document; a long max-age keeps it across sessions. Guarded for the Next
 * static-export build / SSR pass (no `document`), degrading to a no-op so imports never throw.
 *
 * The barrel base file (./sidebarStorage) re-exports this web seam for tsc / Node; the next.config
 * `resolve.extensions` picks this `.web.ts` at web bundle time, while Metro picks `./sidebarStorage.native.ts`.
 */
import type { StateStorage } from "zustand/middleware"

/** Keep the chosen width for a year (renewed on every write). */
const MAX_AGE_SEC = 60 * 60 * 24 * 365

/** True only in a browser with a usable cookie jar (not during the static-export build / SSR). */
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
      // Cookies disabled / blocked: behave as "no persisted value".
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
      // ignore
    }
  },
}
