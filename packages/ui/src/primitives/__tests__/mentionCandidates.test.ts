/**
 * Regression coverage for the @-mention filter. The unscoped (global search) list used to render
 * `search.data.results` raw, so react-query's cached page for a SHORTER prefix stayed on screen while the
 * newer query resolved - showing people who no longer matched what the user had typed.
 *
 * The staleness filter must NOT be narrower than the server that produced those rows: GET
 * /users/mention-search matches `handle ILIKE %q%` OR `display_name ILIKE %q%`, so a handle-PREFIX-only
 * local rule silently dropped fresh, correct rows the server matched mid-handle. Hence the two scopes.
 */
import { describe, expect, it } from "vitest"
import { matchesMentionPrefix, MENTION_RESULT_LIMIT } from "../mentionCandidates"

describe("matchesMentionPrefix", () => {
  it("drops a stale row that matched an earlier, shorter prefix", () => {
    // Typed "@al", the cache holds Alice; the user continues to "@alex".
    expect(matchesMentionPrefix("al", "alice", "Alice Ramos")).toBe(true)
    expect(matchesMentionPrefix("alex", "alice", "Alice Ramos")).toBe(false)
    // ...in the server-backed scope too (the substring rule must not resurrect her).
    expect(matchesMentionPrefix("alex", "alice", "Alice Ramos", "search")).toBe(false)
  })

  it("matches a handle by prefix and a display name anywhere, case-insensitively", () => {
    expect(matchesMentionPrefix("AL", "alex", "Alex Kim")).toBe(true)
    expect(matchesMentionPrefix("kim", "alex", "Alex Kim")).toBe(true)
    // A roster handle matches by prefix only - a mid-handle hit is not a match.
    expect(matchesMentionPrefix("lex", "alex", "Somebody Else")).toBe(false)
    expect(matchesMentionPrefix("lex", "alex", "Somebody Else", "roster")).toBe(false)
  })

  it("keeps a server row matched MID-HANDLE in the search scope", () => {
    // The server returns @kaylee for "lee" (handle ILIKE %lee%) even though the display name has no
    // "lee" in it. Filtering that page with the roster rule would drop a person the user can see the
    // server found, so the search scope matches the handle by substring.
    expect(matchesMentionPrefix("lee", "kaylee", "Kay L.", "search")).toBe(true)
    expect(matchesMentionPrefix("lee", "kaylee", "Kay L.", "roster")).toBe(false)
    // Still a real filter: a row matching NEITHER field is dropped in both scopes.
    expect(matchesMentionPrefix("zzz", "kaylee", "Kay L.", "search")).toBe(false)
  })

  it("matches everything on a bare @ (empty prefix) and ignores surrounding space", () => {
    expect(matchesMentionPrefix("", "alex", "Alex Kim")).toBe(true)
    expect(matchesMentionPrefix("  ", "alex", "Alex Kim")).toBe(true)
    expect(matchesMentionPrefix("", "alex", "Alex Kim", "search")).toBe(true)
  })

  it("caps the rendered people rows at the server's mention-search page size", () => {
    // USER_SEARCH_DEFAULT_LIMIT in the API's users routes - a smaller cap would truncate away people the
    // server legitimately returned (the tray scrolls, so there is nothing to gain from a tighter cap).
    expect(MENTION_RESULT_LIMIT).toBe(10)
  })
})
