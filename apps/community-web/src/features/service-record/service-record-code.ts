import { normalizeCertificateCode } from "@civfix/shared"

import { routeSegment } from "@/lib/route-segment"

/**
 * Not `usePathname()`: under output: "export" the Cloudflare rewrite `/service-record/* ->
 * /service-record/_/ 200` serves the placeholder document while the address bar keeps the real
 * `/service-record/<code>/`, so Next's router reports the placeholder path. The view reads
 * `window.location.pathname` and the placeholder is guarded here, as `seedPathname()` does in
 * web-nav-controller.ts.
 */

/** Shared by the parser and the view so the two cannot drift. */
export const SERVICE_RECORD_SEGMENT = "service-record"

/** `invalid` is distinct from `none` so a mistyped link is not silently downgraded to an empty form. */
export type ServiceRecordCodeSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "code"; readonly code: string }

const NONE: ServiceRecordCodeSource = { kind: "none" }

/** A printed code is hand-typed, so it may arrive percent-encoded as well as with or without a slash. */
export function serviceRecordCodeFromPath(pathname: string | null | undefined): ServiceRecordCodeSource {
  const segment = routeSegment(pathname, SERVICE_RECORD_SEGMENT)
  if (segment.kind === "none") return NONE
  if (segment.kind === "undecodable") return { kind: "invalid", raw: segment.raw }

  const code = normalizeCertificateCode(segment.value)
  return code === null ? { kind: "invalid", raw: segment.value } : { kind: "code", code }
}

/** Trailing slash to match `trailingSlash: true` and the Cloudflare rule. */
export function serviceRecordPath(code: string): string {
  return `/${SERVICE_RECORD_SEGMENT}/${encodeURIComponent(code)}/`
}
