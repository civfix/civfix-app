/**
 * The pure matching rule behind the @-mention typeahead, extracted from MentionAutocomplete so BOTH the
 * scoped (room-roster) and unscoped (global search) lists run the SAME filter and it can be unit tested.
 *
 * Why the unscoped list must filter too: those rows come from a react-query cache keyed on the prefix, so
 * while a newer query is in flight `search.data` still holds the PREVIOUS prefix's page - rendering it raw
 * showed people who no longer match what the user has typed.
 *
 * Why the rule is SCOPED: that staleness filter runs over rows the SERVER already matched, and the server
 * (GET /users/mention-search) matches a substring ANYWHERE in the handle or the display name. A local
 * handle-PREFIX rule is strictly narrower, so it would also throw away fresh, correct rows - typing "@lee"
 * would drop the "kaylee" the server just returned. So a server-backed list is filtered with the server's
 * own semantics ("search"), while a locally-owned candidate list - the room roster, the jurisdiction row -
 * keeps the tighter handle-prefix rule the user is literally typing ("roster").
 */

/**
 * Cap on rendered people rows; the tray shows a few and scrolls past that. Matches the server's fixed
 * mention-search page size (USER_SEARCH_DEFAULT_LIMIT = 10), so the local filter never truncates away a
 * person the server legitimately returned.
 */
export const MENTION_RESULT_LIMIT = 10

/**
 * Where a candidate list came from, which decides how strictly its HANDLE must match:
 *   - "roster": a locally-owned, complete candidate set (the room's members, the report's jurisdiction).
 *               The handle matches by PREFIX - what the user is literally typing after the "@".
 *   - "search": a page the SERVER already matched (the global mention search). The handle matches by
 *               SUBSTRING, mirroring the server's `handle ILIKE %q%`, so filtering out stale rows from an
 *               older prefix never discards a fresh row the server matched mid-handle.
 */
export type MentionMatchScope = "roster" | "search"

/**
 * Does a candidate match the active "@<prefix>" token? The display name matches anywhere in the string in
 * both scopes (so "@sam" still finds "Rosa Sample"); the handle matches by prefix or by substring per
 * `scope` (see MentionMatchScope). An empty prefix matches everything - the bare "@" case, where the
 * search is disabled.
 */
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
