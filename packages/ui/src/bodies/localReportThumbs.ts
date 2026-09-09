/**
 * localReportThumbs - a tiny, session-scoped overlay that keeps a just-created report's LOCAL photo uri
 * reachable by the feed card that renders it.
 *
 * WHY THIS EXISTS (it is not an optimisation - without it the user watches their photo vanish):
 * When "Share to the feed" posts a freshly created report, the post is created 200-400ms after the report.
 * At that moment the report's media asset is still `status:'validating'` (the intake service enqueues an
 * async worker job), and the server's linked-report projection joins a LATERAL that hard-requires
 * `status = 'ready'`. So the AUTHORITATIVE PostDTO comes back with `report.thumbUrl` ABSENT, and the
 * immediate `onSettled` refetch does not restore it either (the asset is still validating). An optimistic
 * card seeded with the local uri would therefore paint the photo and then lose it on the very next server
 * round-trip.
 *
 * The overlay fixes that without any cache surgery:
 *   - `PostCard` resolves `post.report.thumbUrl ?? localReportThumb(post.report.id)`, so a missing server
 *     thumb falls back to the local capture.
 *   - SERVER ALWAYS WINS. The moment the worker flips the asset to `ready` and any refetch lands, the real
 *     presigned thumb takes over - no invalidation, no forgetting, no expiry logic.
 *   - It SURVIVES EVERY REFETCH, unlike a merged cache row (which `onSettled`'s refetch destroys).
 *   - It is correctly scoped: a module-level map on the AUTHOR's own device, populated only from their own
 *     capture, that dies with the JS context - which on web is exactly when a `blob:` url is revoked, so a
 *     stale entry is unreachable by construction.
 *
 * Deliberately dependency-free (no react, no store) so it is importable from any layer and unit-testable.
 */

/** How many report thumbs to retain. An LRU bound - one report per share, so this is generous. */
const MAX_LOCAL_THUMBS = 20

/** reportId -> the local media uri (`file://` / `ph://` on native, `blob:` on web). */
const thumbs = new Map<string, string>()

/**
 * Remember the local capture uri for a report the viewer just created, so a feed card for it can paint the
 * photo before the server's thumbnail exists. Re-remembering an id refreshes its LRU recency.
 */
export function rememberLocalReportThumb(reportId: string, uri: string): void {
  if (thumbs.has(reportId)) thumbs.delete(reportId)
  thumbs.set(reportId, uri)
  while (thumbs.size > MAX_LOCAL_THUMBS) {
    const oldest = thumbs.keys().next().value
    if (oldest === undefined) break
    thumbs.delete(oldest)
  }
}

/** The remembered local uri for a report, or null when this session never captured it. */
export function localReportThumb(reportId: string): string | null {
  return thumbs.get(reportId) ?? null
}

/** Drop every remembered thumb. Test-only seam (the map is otherwise session-lifetime by design). */
export function clearLocalReportThumbs(): void {
  thumbs.clear()
}
