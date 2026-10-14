import { ORG_SLUG_MAX, ORG_SLUG_MIN, OrgSlugSchema } from "@civfix/shared"

import { PRODUCTION_SITE_URL } from "@/lib/site-meta"

/** The bare host shown in front of a public org path, e.g. "civfix.org". */
export const PUBLIC_ORG_HOST = PRODUCTION_SITE_URL.replace(/^https?:\/\//, "")

/**
 * Derive a candidate public handle from an organization name, in the shape OrgSlugSchema accepts:
 * lowercase kebab-case, ASCII letters and digits only. Accented letters are folded to their base
 * letter first so "Café Río" becomes "cafe-rio" rather than "caf-r-o". The result may still be too
 * SHORT to be valid (a one-letter name); callers validate with `orgSlugProblem` before use.
 */
export function slugFromOrgName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, ORG_SLUG_MAX)
    .replace(/-+$/g, "")
}

export type OrgSlugProblem = "empty" | "short" | "long" | "format"

/** Why a typed slug is not yet valid, or null when OrgSlugSchema accepts it. */
export function orgSlugProblem(slug: string): OrgSlugProblem | null {
  const trimmed = slug.trim()
  if (trimmed.length === 0) return "empty"
  if (trimmed.length < ORG_SLUG_MIN) return "short"
  if (trimmed.length > ORG_SLUG_MAX) return "long"
  return OrgSlugSchema.safeParse(trimmed).success ? null : "format"
}

/** The public URL a slug will live at, shown as a preview while the host types. */
export function publicOrgPath(slug: string): string {
  return `/orgs/${slug}/`
}

/** The public page's address as the console prints it: host and path, no scheme. */
export function publicOrgUrlLabel(slug: string): string {
  return `${PUBLIC_ORG_HOST}${publicOrgPath(slug)}`
}
