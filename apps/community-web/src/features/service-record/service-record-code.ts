import { normalizeCertificateCode } from "@civfix/shared"

/**
 * Not `usePathname()`: under output: "export" the Cloudflare rewrite `/service-record/* ->
 * /service-record/_/ 200` serves the placeholder document while the address bar keeps the real
 * `/service-record/<code>/`, so Next's router reports the placeholder path. The view reads
 * `window.location.pathname` and the placeholder is guarded here, as `seedPathname()` does in
 * use-web-nav-adapter.ts.
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
  if (!pathname) return NONE

  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== SERVICE_RECORD_SEGMENT) return NONE

  const raw = segments[1]
  // "_" is the generateStaticParams placeholder segment: the shell document itself, never a real code.
  if (raw === undefined || raw === "_") return NONE

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // A malformed escape sequence ("%zz") throws URIError; treat it as a bad code, not a crash.
    return { kind: "invalid", raw }
  }

  const code = normalizeCertificateCode(decoded)
  return code === null ? { kind: "invalid", raw: decoded } : { kind: "code", code }
}

/** Trailing slash to match `trailingSlash: true` and the Cloudflare rule. */
export function serviceRecordPath(code: string): string {
  return `/${SERVICE_RECORD_SEGMENT}/${encodeURIComponent(code)}/`
}
