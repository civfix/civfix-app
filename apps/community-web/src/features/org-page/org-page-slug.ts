import { OrgSlugSchema } from "@civfix/shared"

export const ORG_PAGE_SEGMENT = "orgs"

export type OrgSlugSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "slug"; readonly slug: string }

const NONE: OrgSlugSource = { kind: "none" }

export const ORG_MANAGE_SEGMENT = "manage"

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
  if (!pathname) return NONE

  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== ORG_PAGE_SEGMENT) return NONE

  const raw = segments[1]
  if (raw === undefined || raw === "_") return NONE

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return { kind: "invalid", raw }
  }

  const parsed = OrgSlugSchema.safeParse(decoded)
  return parsed.success ? { kind: "slug", slug: parsed.data } : { kind: "invalid", raw: decoded }
}
