/**
 * One mention-token grammar for the whole chat surface. Both sides of a mention used to carry their
 * own regex - the renderer tinted `@alex` with no left boundary at all (so it lit up inside
 * `bob@alex.com`), while the submit-time filter demanded whitespace before it (so a mention typed
 * after punctuation - `(@alex)`, `hi,@alex` - was silently dropped from the sent mention ids even
 * though every reader saw it tinted). They now share these helpers, so display and delivery can
 * never disagree, and the handle is always regex-escaped before it reaches `new RegExp`.
 *
 * The grammar: a mention starts at the beginning of the body or after a character that is neither a
 * word character nor `@` (so an email's local part can't produce one), and ends at a non-word
 * character.
 */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Handles travel with or without the leading `@` depending on the source DTO; normalize both. */
export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "")
}

const LEFT_BOUNDARY = "(^|[^\\w@])"
const RIGHT_BOUNDARY = "(?![\\w])"

/**
 * A global scanner over MANY handles (the renderer's tokenizer). Group 1 is the boundary character
 * consumed before the token (empty at the start of the body), group 2 the matched handle - so the
 * token itself starts at `match.index + match[1].length`. Longest handles first, so `@alexa` wins
 * over `@alex`.
 */
export function mentionScanRegex(handles: string[]): RegExp {
  const alternatives = [...handles]
    .map(normalizeHandle)
    .filter((h) => h.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
  return new RegExp(`${LEFT_BOUNDARY}@(${alternatives.join("|")})${RIGHT_BOUNDARY}`, "g")
}

/** Does `body` mention this exact handle? (the submit-time filter over the staged mention list). */
export function bodyMentionsHandle(body: string, handle: string): boolean {
  const h = normalizeHandle(handle)
  if (h.length === 0) return false
  return new RegExp(`${LEFT_BOUNDARY}@${escapeRegExp(h)}${RIGHT_BOUNDARY}`).test(body)
}
