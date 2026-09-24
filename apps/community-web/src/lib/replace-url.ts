/**
 * Rewrites the current history entry's URL without adding one, for a capability token that must leave the
 * address bar. No state object: Next's patched replaceState skips syncing its router for an entry it
 * marked (__NA), so it would keep the old URL and write it back on its next navigation.
 */
export function replaceUrlInPlace(url: string): void {
  window.history.replaceState(null, "", url)
}
