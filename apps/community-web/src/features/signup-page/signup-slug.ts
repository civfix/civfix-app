import { PageSlugSchema } from "@civfix/shared"

import { routeSegment } from "@/lib/route-segment"

const SIGNUP_SEGMENT = "e"

export type SignupSlugSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "slug"; readonly slug: string }

const NONE: SignupSlugSource = { kind: "none" }

export function signupSlugFromPath(pathname: string | null | undefined): SignupSlugSource {
  const segment = routeSegment(pathname, SIGNUP_SEGMENT)
  if (segment.kind === "none") return NONE
  if (segment.kind === "undecodable") return { kind: "invalid", raw: segment.raw }

  const parsed = PageSlugSchema.safeParse(segment.value)
  return parsed.success ? { kind: "slug", slug: parsed.data } : { kind: "invalid", raw: segment.value }
}

export function signupPath(slug: string): string {
  return `/${SIGNUP_SEGMENT}/${encodeURIComponent(slug)}/`
}

export function accessCodeFromSearch(search: string | null | undefined): string | null {
  const value = new URLSearchParams(search ?? "").get("code")
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
