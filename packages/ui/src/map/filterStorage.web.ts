/**
 * Filter-store persistence storage - WEB seam.
 *
 * The map layer-filter store (./filterStore) persists its selection via zustand's `persist` middleware.
 * That middleware needs a synchronous `StateStorage` (getItem/setItem/removeItem). On web that is
 * `window.localStorage`, guarded so the Next static-export build / SSR pass (no `window`) degrades to a
 * no-op instead of throwing. The barrel base file (./filterStorage) re-exports this web seam for tsc /
 * Node; the next.config `resolve.extensions` picks this `.web.ts` at web bundle time, while Metro picks
 * `./filterStorage.native.ts`.
 */
import type { StateStorage } from "zustand/middleware"

/** True only in a browser with a usable localStorage (not during the static-export build / SSR). */
function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export const mapFilterStorage: StateStorage = {
  getItem: (name) => {
    if (!available()) return null
    try {
      return window.localStorage.getItem(name)
    } catch {
      // SecurityError (private mode) or quota issues: behave as "no persisted value".
      return null
    }
  },
  setItem: (name, value) => {
    if (!available()) return
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Storage full / blocked: skip the write (the in-memory selection still works this session).
    }
  },
  removeItem: (name) => {
    if (!available()) return
    try {
      window.localStorage.removeItem(name)
    } catch {
      // ignore
    }
  },
}
