import { useSyncExternalStore } from "react"
import { COARSE_POINTER_QUERY, isCoarsePointer, mediaQuery } from "./webMedia"

export function subscribeCoarsePointer(notify: () => void): () => void {
  const query = mediaQuery(COARSE_POINTER_QUERY)
  if (!query) return () => {}
  query.addEventListener("change", notify)
  return () => query.removeEventListener("change", notify)
}

export function readCoarsePointer(): boolean {
  return isCoarsePointer()
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
