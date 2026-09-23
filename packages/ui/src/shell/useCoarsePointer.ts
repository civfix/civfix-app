import { useSyncExternalStore } from "react"

const COARSE_POINTER_QUERY = "(pointer: coarse)"

function coarsePointerQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  return window.matchMedia(COARSE_POINTER_QUERY)
}

export function subscribeCoarsePointer(notify: () => void): () => void {
  const query = coarsePointerQuery()
  if (!query) return () => {}
  query.addEventListener("change", notify)
  return () => query.removeEventListener("change", notify)
}

export function readCoarsePointer(): boolean {
  return coarsePointerQuery()?.matches ?? false
}

/** The static export prerenders with no window; hydration must see the same `false` the markup was built with. */
export function readCoarsePointerOnServer(): boolean {
  return false
}

/**
 * True while the primary pointer is coarse (touch). Follows a live change, such as a tablet docking a
 * mouse. Always false on native, where there is no matchMedia.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarsePointer, readCoarsePointer, readCoarsePointerOnServer)
}
