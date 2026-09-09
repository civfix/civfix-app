/**
 * Pure state model for the service-hours certificate card (`ServiceHoursCertificateCard`).
 *
 * The card is TWO-PHASE by necessity, not by taste: "Prepare transcript" issues the document, and a
 * SECOND, real press opens it. On web `openExternal` is `window.open`, and a `window.open` executed in
 * a promise continuation after an `await` has lost its user-activation token - Chrome and Safari block
 * it. The second press restores a genuine gesture, and it is where the verification code wants to be
 * shown anyway.
 *
 * `now` is INJECTED. Nothing here reads the clock, so the card can drive the expiry countdown off its
 * own interval and these rules stay testable without fake timers.
 */
import { appErrorCode } from "./errorCode"

export type CertificateCardState =
  /** No hours to certify - the action is visible but inert. */
  | "disabled"
  /** Nothing issued yet: the "Prepare transcript" press. */
  | "idle"
  /** The issue mutation is in flight. */
  | "preparing"
  /** A certificate with a LIVE download link: show the code, "Open PDF", share and revoke. */
  | "ready"
  /** A certificate whose presigned link has lapsed: re-issue returns the SAME code, a fresh URL. */
  | "expired"
  /** The last issue attempt failed; the card keeps the idle press plus an inline reason. */
  | "error"

/**
 * Precedence: disabled > preparing > error > idle > expired > ready.
 *
 * `disabled` outranks everything because a 0-hour ledger has nothing to certify - an error line about
 * a document that could never exist is noise. `preparing` outranks `error` so a RETRY after a failure
 * shows the spinner rather than the stale error it is busy clearing.
 *
 * `urlExpiresAt` absent/null/unparseable means "no live link", which is `expired`, not `ready`: the
 * only honest thing the card can offer then is a refresh, and re-issuing is free (it hits the
 * fingerprint cache and returns the same code).
 */
export function certificateCardState(input: {
  hasCertificate: boolean
  isPending: boolean
  isError: boolean
  totalHours: number
  urlExpiresAt?: string | null
  now: number
}): CertificateCardState {
  if (input.totalHours <= 0) return "disabled"
  if (input.isPending) return "preparing"
  if (input.isError) return "error"
  if (!input.hasCertificate) return "idle"
  const expiresAt = input.urlExpiresAt ? new Date(input.urlExpiresAt).getTime() : Number.NaN
  if (Number.isNaN(expiresAt) || expiresAt <= input.now) return "expired"
  return "ready"
}

/**
 * The i18n suffix for the inline failure line. Only the rate limit gets its own copy - it is the one
 * failure with a specific, actionable cause ("wait a bit"), and the issue endpoint is deliberately
 * rate-limited because each call can render a PDF.
 */
export function certificateErrorKey(err: unknown): "rate_limited" | "generic" {
  return appErrorCode(err) === "RATE_LIMITED" ? "rate_limited" : "generic"
}

/**
 * How urgently the link is about to lapse. The expiry copy itself is a fixed string ("This download
 * link expires in 15 minutes. The verification code does not."), so this is a TONE, not a countdown -
 * it lets the card mute the line normally and emphasize it in the last couple of minutes.
 *
 * An already-lapsed or unparseable expiry reads as "soon"; `certificateCardState` is what actually
 * flips the card to `expired`.
 */
export const CERTIFICATE_EXPIRY_SOON_MS = 2 * 60 * 1000

export function certificateExpiryLabel(expiresAt: string, now: number): "soon" | "ok" {
  const at = new Date(expiresAt).getTime()
  if (Number.isNaN(at)) return "soon"
  return at - now <= CERTIFICATE_EXPIRY_SOON_MS ? "soon" : "ok"
}
