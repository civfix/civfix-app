const ROOT_ROUTE = "/"

function routeQuery(params: unknown): string {
  if (params === null || typeof params !== "object") return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (typeof value === "string") {
      search.append(key, value)
      continue
    }
    if (!Array.isArray(value)) continue
    for (const item of value) if (typeof item === "string") search.append(key, item)
  }
  return search.toString().replace(/\*/g, "%2A")
}

export function hrefFromRoute(pathname: unknown, params?: unknown): string {
  const path =
    typeof pathname === "string" && pathname.startsWith("/") && !pathname.startsWith("//")
      ? pathname
      : ROOT_ROUTE
  const query = routeQuery(params)
  return query.length > 0 ? `${path}?${query}` : path
}

export function resumePathname(href: string): string {
  const cut = href.search(/[?#]/)
  const path = cut === -1 ? href : href.slice(0, cut)
  if (path.length > 1 && path.endsWith("/")) {
    const trimmed = path.replace(/\/+$/, "")
    return trimmed.length > 0 ? trimmed : "/"
  }
  return path
}

export function shouldReplaceOnSignIn(current: unknown, next: unknown): boolean {
  if (typeof next !== "string" || next.length === 0) return true
  if (typeof current !== "string" || current.length === 0) return true
  return resumePathname(current) !== resumePathname(next)
}
