export const FEED_TOP_CLEAR_OFFSET = 1

export function addPendingNewPost(
  ids: readonly string[],
  id: string,
): readonly string[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function clearsPendingAtOffset(offsetY: number, pendingCount: number): boolean {
  return pendingCount > 0 && offsetY <= FEED_TOP_CLEAR_OFFSET
}

export function dedupePostsById<T extends { id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique.length === items.length ? items : unique
}

/**
 * iOS and Android have no polite live region for the pill, so native announces explicitly. Only the
 * appearance edge speaks: every later arrival while the pill is up would otherwise interrupt the reader.
 */
export function shouldAnnounceNewPosts(previousCount: number, count: number): boolean {
  return previousCount === 0 && count > 0
}
