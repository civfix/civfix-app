import { normalizeCertificateCode } from "@civfix/shared"

/**
 * Pure pathname -> certificate-code resolution for the public /service-record page.
 *
 * WHY A PURE FUNCTION IN ITS OWN MODULE: the web test suite is vitest/node with NO jsdom, so a
 * component cannot be rendered in a test. Keeping the URL parsing here (rather than inline in the view's
 * effect) is what makes the one piece of real logic on that page testable at all - see
 * service-record-code.test.ts.
 *
 * WHY NOT `usePathname()`: under output:"export" + the Cloudflare rewrite `/service-record/* ->
 * /service-record/_/ 200`, the SERVER hands the browser the placeholder document while the browser's
 * address bar keeps the real `/service-record/<code>/`. Next's router therefore reports the placeholder
 * path. The view reads `window.location.pathname` instead and guards the placeholder here, exactly as
 * `seedPathname()` does in components/home/use-web-nav-adapter.ts.
 */

/** The route's first path segment. Kept as a constant so the parser and the view cannot drift. */
export const SERVICE_RECORD_SEGMENT = "service-record"

/**
 * What the URL says about the code to verify.
 *
 *  - `none`    - no code in the path (a bare /service-record/, or the /_/ static-export placeholder):
 *                the page shows its "enter a code" input.
 *  - `invalid` - a segment is present but cannot be a certificate code: the page shows `bad_code`
 *                WITHOUT a network round trip. Distinct from `none` so a mistyped link is not silently
 *                downgraded to an empty form.
 *  - `code`    - the canonical 12-char Crockford form, ready to send to the public verify endpoint.
 */
export type ServiceRecordCodeSource =
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "code"; readonly code: string }

const NONE: ServiceRecordCodeSource = { kind: "none" }

/**
 * Extract and canonicalize the certificate code from a pathname.
 *
 * Accepts every form the static export can produce: with or without a trailing slash, and
 * percent-encoded (a printed code is hand-typed, so `CFX-A1B2-C3D4-E5F6` may arrive URL-escaped).
 * `normalizeCertificateCode` does the loose-in/canonical-out work (case, `CFX-` prefix, separators).
 */
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

/**
 * The canonical page path for a verified code, so the address bar becomes a shareable permalink after a
 * code is typed into the form. Trailing slash to match `trailingSlash: true` (and the Cloudflare rule).
 */
export function serviceRecordPath(code: string): string {
  return `/${SERVICE_RECORD_SEGMENT}/${encodeURIComponent(code)}/`
}
