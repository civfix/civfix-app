export const DONATE_SEGMENT = "donate"
export const DONATE_COMPLETE_SEGMENT = "complete"

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/

export type DonateRoute =
  | { readonly kind: "missing" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "form"; readonly slug: string }
  | { readonly kind: "complete"; readonly slug: string }

const MISSING: DonateRoute = { kind: "missing" }

export function parseDonateRoute(pathname: string | null | undefined): DonateRoute {
  if (!pathname) return MISSING

  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== DONATE_SEGMENT) return MISSING

  const raw = segments[1]
  if (raw === undefined || raw === "_") return MISSING

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return { kind: "invalid", raw }
  }

  const slug = decoded.trim().toLowerCase()
  if (!SLUG_PATTERN.test(slug)) return { kind: "invalid", raw: decoded }

  const tail = segments.slice(2)
  if (tail.length === 0) return { kind: "form", slug }
  if (tail.length === 1 && tail[0] === DONATE_COMPLETE_SEGMENT) return { kind: "complete", slug }
  return { kind: "invalid", raw: decoded }
}

export function donateFormPath(slug: string): string {
  return `/${DONATE_SEGMENT}/${encodeURIComponent(slug)}/`
}

export function donateCompletePath(slug: string): string {
  return `/${DONATE_SEGMENT}/${encodeURIComponent(slug)}/${DONATE_COMPLETE_SEGMENT}/`
}

export interface CompleteParams {
  readonly donationId: string | null
  readonly statusToken: string | null
  readonly sessionId: string | null
}

export function parseCompleteParams(search: string | null | undefined): CompleteParams {
  const params = new URLSearchParams(search ?? "")
  const read = (key: string): string | null => {
    const value = params.get(key)
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 || trimmed.startsWith("{") ? null : trimmed
  }
  return {
    donationId: read("donation"),
    statusToken: read("t"),
    sessionId: read("session_id"),
  }
}

export function parseEventParam(search: string | null | undefined): string | null {
  const value = new URLSearchParams(search ?? "").get("event")
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function statusTokenStorageKey(donationId: string): string {
  return `civfix.donate.status.${donationId}`
}
