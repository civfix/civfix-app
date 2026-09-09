/**
 * Guard for server-provided navigation targets (e.g. NotificationDTO.link, which is typed only as a
 * string). We only ever navigate WITHIN the app via the Next router, so a link is accepted only when
 * it is a same-origin, absolute, relative path. This defends against an open-redirect / scheme-
 * injection shaped risk (javascript:, data:, http(s)://evil, protocol-relative //evil) if the backend
 * ever reflects user/content-derived links.
 *
 * Accepted:  "/", "/pin/abc", "/people/123?tab=cleanups", "/x#frag"
 * Rejected:  "", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "  /x"
 */
export function isSafeInternalPath(link: string | null | undefined): boolean {
  if (typeof link !== "string") return false
  // No surrounding whitespace games: a leading space could smuggle "  javascript:..." past naive
  // checks elsewhere, and a real route never starts with whitespace.
  if (link !== link.trim()) return false
  // Must be an absolute in-app path.
  if (!link.startsWith("/")) return false
  // Reject protocol-relative ("//host") and backslash variants ("/\\host") that browsers may treat as
  // a host-relative or scheme-relative URL.
  if (link.startsWith("//") || link.startsWith("/\\")) return false
  return true
}
