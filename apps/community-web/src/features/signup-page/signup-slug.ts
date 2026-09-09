export const SIGNUP_SEGMENT = "e"

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG_MIN = 3
const SLUG_MAX = 60

export type SignupSlugSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "slug"; readonly slug: string }

const NONE: SignupSlugSource = { kind: "none" }

export function signupSlugFromPath(pathname: string | null | undefined): SignupSlugSource {
  if (!pathname) return NONE

  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== SIGNUP_SEGMENT) return NONE

  const raw = segments[1]
  if (raw === undefined || raw === "_") return NONE

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return { kind: "invalid", raw }
  }

  const slug = decoded.trim().toLowerCase()
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) {
    return { kind: "invalid", raw: decoded }
  }
  return { kind: "slug", slug }
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
