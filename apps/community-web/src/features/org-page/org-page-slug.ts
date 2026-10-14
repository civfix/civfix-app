import { OrgSlugSchema } from "@civfix/shared"

import { routeSegment } from "@/lib/route-segment"

const ORG_PAGE_SEGMENT = "orgs"

export type OrgSlugSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "slug"; readonly slug: string }

const NONE: OrgSlugSource = { kind: "none" }

const ORG_MANAGE_SEGMENT = "manage"

export function isOrgManagePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  return segments[0] === ORG_PAGE_SEGMENT && segments[2] === ORG_MANAGE_SEGMENT
}

/**
 * Read the org slug from a live `/orgs/<slug>/` URL. Under the static export the route shell is
 * emitted at `/orgs/_/`, so the placeholder segment reads as "none" rather than as a slug.
 */
export function orgSlugFromPath(pathname: string | null | undefined): OrgSlugSource {
  const segment = routeSegment(pathname, ORG_PAGE_SEGMENT)
  if (segment.kind === "none") return NONE
  if (segment.kind === "undecodable") return { kind: "invalid", raw: segment.raw }

  const parsed = OrgSlugSchema.safeParse(segment.value)
  return parsed.success ? { kind: "slug", slug: parsed.data } : { kind: "invalid", raw: segment.value }
}
