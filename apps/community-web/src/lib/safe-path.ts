/**
 * Untrusted navigation targets are accepted only as absolute in-app paths, which blocks open redirects
 * and scheme injection (javascript:, data:, https://evil, //evil).
 */
export function isSafeInternalPath(link: string | null | undefined): boolean {
  if (typeof link !== "string") return false
  // A leading space could smuggle "  javascript:..." past naive checks elsewhere.
  if (link !== link.trim()) return false
  if (!link.startsWith("/")) return false
  // Browsers may treat "//host" and "/\\host" as scheme-relative URLs.
  if (link.startsWith("//") || link.startsWith("/\\")) return false
  return true
}
