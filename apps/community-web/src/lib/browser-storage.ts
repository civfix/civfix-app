/**
 * Web Storage access that never throws. Every caller keeps a convenience the page works without (a
 * preference, or a hand-off the URL or server also carries), so an unavailable store reads as "nothing
 * saved" and a failed write or removal is dropped: the static-export prerender has no `window`, and
 * private mode, blocked site data or a full quota throw on access.
 */
export type BrowserStorageArea = "local" | "session"

function storageFor(area: BrowserStorageArea): Storage {
  return area === "local" ? window.localStorage : window.sessionStorage
}

export function storageAvailable(area: BrowserStorageArea): boolean {
  if (typeof window === "undefined") return false
  try {
    return typeof storageFor(area) !== "undefined"
  } catch {
    return false
  }
}

export function safeGet(area: BrowserStorageArea, key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return storageFor(area).getItem(key)
  } catch {
    return null
  }
}

export function safeSet(area: BrowserStorageArea, key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    storageFor(area).setItem(key, value)
  } catch {
    return
  }
}

export function safeRemove(area: BrowserStorageArea, key: string): void {
  if (typeof window === "undefined") return
  try {
    storageFor(area).removeItem(key)
  } catch {
    return
  }
}
