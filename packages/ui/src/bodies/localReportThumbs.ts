/**
 * Keeps a just-created report's local photo uri reachable by its feed card. Until the worker marks the asset
 * `ready` the server's linked-report projection has no thumbUrl, so without this the photo would vanish on the
 * next refetch. The server thumb always wins once present. Entries are LRU-bounded, exist only on the author's
 * device for this session and die with the JS context, which on web is also when a `blob:` url is revoked.
 */

/** One report per share, so this LRU bound is generous. */
const MAX_LOCAL_THUMBS = 20

/** reportId -> the local media uri (`file://` / `ph://` on native, `blob:` on web). */
const thumbs = new Map<string, string>()

/** Re-remembering an id refreshes its LRU recency. */
export function rememberLocalReportThumb(reportId: string, uri: string): void {
  if (thumbs.has(reportId)) thumbs.delete(reportId)
  thumbs.set(reportId, uri)
  while (thumbs.size > MAX_LOCAL_THUMBS) {
    const oldest = thumbs.keys().next().value
    if (oldest === undefined) break
    thumbs.delete(oldest)
  }
}

export function localReportThumb(reportId: string): string | null {
  return thumbs.get(reportId) ?? null
}

/** Test-only seam: the map is otherwise session-lifetime by design. */
export function clearLocalReportThumbs(): void {
  thumbs.clear()
}
