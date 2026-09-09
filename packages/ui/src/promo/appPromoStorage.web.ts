/**
 * App-promo dismissal storage - WEB seam (localStorage).
 *
 * The promo dismissal (./appPromoStore) persists via zustand's `persist` middleware, which needs a
 * synchronous `StateStorage`. Unlike the sidebar width (a cookie, so it rides along with the document)
 * this is a pure client-side preference, so it uses localStorage - matching the app's other `civfix.*`
 * preference keys (civfix.locale, civfix.anon-report-draft).
 *
 * Guarded for the Next static-export build / SSR pass (no `window`) and for Safari private mode (where
 * localStorage access throws), degrading to a no-op so imports never throw.
 *
 * The barrel base file (./appPromoStorage) re-exports this web seam for tsc / Node; the next.config
 * `resolve.extensions` picks this `.web.ts` at web bundle time, while Metro picks `.native.ts`.
 */
import type { StateStorage } from "zustand/middleware"

/** True only in a browser with a usable localStorage (not during the static-export build / SSR). */
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
      // ignore
    }
  },
}
