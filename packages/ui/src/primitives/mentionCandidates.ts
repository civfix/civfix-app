/**
 * The @-mention filter shared by the roster and search lists. The search list must filter too: its
 * react-query cache still holds the previous prefix's page while a newer query is in flight.
 */

/** Matches the server's mention-search page size, so the local filter never drops a row the server returned. */
export const MENTION_RESULT_LIMIT = 10

/**
 * A "roster" is a complete local set, so its handle matches by prefix. A "search" page was already matched
 * by the server's `handle ILIKE %q%`, so a prefix rule there would drop fresh mid-handle hits.
 */
export type MentionMatchScope = "roster" | "search"

export function matchesMentionPrefix(
  prefix: string,
  handle: string,
  displayName: string,
  scope: MentionMatchScope = "roster",
): boolean {
  const q = prefix.trim().toLowerCase()
  if (q === "") return true
  const h = handle.toLowerCase()
  const handleHit = scope === "search" ? h.includes(q) : h.startsWith(q)
  return handleHit || displayName.toLowerCase().includes(q)
}
