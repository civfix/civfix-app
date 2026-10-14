export type RouteSegment =
  | { readonly kind: "none" }
  | { readonly kind: "raw"; readonly value: string }
  | { readonly kind: "undecodable"; readonly raw: string }

const NONE: RouteSegment = { kind: "none" }

// generateStaticParams emits every catch-all detail route at "<prefix>/_/": the shell document itself,
// never a real id.
const STATIC_EXPORT_PLACEHOLDER = "_"

/**
 * Read and percent-decode the segment after `/<prefix>/`. `undecodable` is distinct from `none` so a
 * mistyped link ("%zz" throws URIError) reads as a bad value rather than an empty page.
 */
export function routeSegment(pathname: string | null | undefined, prefix: string): RouteSegment {
  if (!pathname) return NONE

  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== prefix) return NONE

  const raw = segments[1]
  if (raw === undefined || raw === STATIC_EXPORT_PLACEHOLDER) return NONE

  try {
    return { kind: "raw", value: decodeURIComponent(raw) }
  } catch {
    return { kind: "undecodable", raw }
  }
}
