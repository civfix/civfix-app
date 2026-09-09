import type { ErrorCode } from "@civfix/shared"

import { toAppError } from "@/lib/api"

/**
 * Map a thrown value to friendly, user-actionable copy.
 *
 * Each surface (auth, report, host, claim, pin...) used to re-declare a `messageFor(err)` switch over
 * ErrorCode. This collapses the ceremony: callers pass only the codes whose copy is domain-specific
 * via `overrides`, and the helper falls back to `fallback` or a generic line.
 *
 * i18n note (spec §6: "errors map by code, not message"): this router intentionally **never surfaces raw
 * server message text** anymore. Each surface owns the localization of the codes it cares about — it
 * resolves its strings through its own `useT(<ns>)` and passes already-translated copy in via
 * `overrides` / `fallback`. The router only decides which of those localized strings to show. The
 * public API (`errorMessage(err, overrides, opts)`) is unchanged so those callers keep working.
 *
 * The error is normalized with toAppError first, so callers can pass the raw caught value.
 *
 *  - `overrides[code]` wins when present (the domain-specific, pre-translated copy, e.g. TURNSTILE_FAILED
 *    for report, CONFLICT for claim).
 *  - otherwise `fallback` is used. Callers pass a localized `fallback`; the built-in English default is a
 *    last-resort only (e.g. tests / non-localized call sites) and should be overridden in localized UI.
 *  - `preferServerMessage` is retained for API compatibility but no longer leaks server text: when an
 *    unmapped code is hit it resolves to `fallback` either way. (It is effectively a no-op now; kept so
 *    existing call sites that pass it continue to type-check.)
 *
 * Strings shown here are localized by the CALLER, not this module: it is a plain (non-hook) helper and
 * cannot call `useT` itself.
 */
export function errorMessage(
  err: unknown,
  overrides: Partial<Record<ErrorCode, string>> = {},
  opts: { fallback?: string; preferServerMessage?: boolean } = {},
): string {
  // The built-in default is the i18n default value for `web-errors:generic_fallback`. Localized UI
  // overrides it by passing `{ fallback: genericErrorMessage(t) }` (t bound to `web-errors`); this
  // English literal is only the last-resort for tests / non-localized call sites.
  const { fallback = "Something went wrong. Please try again." } = opts
  const e = toAppError(err)
  const override = overrides[e.code]
  if (override !== undefined) return override
  return fallback
}

/** Codes that have a shared baseline message in the `web-errors:code.*` catalog. */
const BASELINE_CODES = [
  "VALIDATION",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CONFLICT",
  "NOT_FOUND",
  "TURNSTILE_FAILED",
] as const

/**
 * Shared, localized baseline overrides for the common server error codes (spec §6: map codes → strings,
 * never raw server text). A surface spreads these into its `errorMessage` overrides so any code it does
 * not give domain-specific copy for still resolves to a localized line, then layers its own on top:
 *
 *   const { t } = useT("web-errors")
 *   errorMessage(err, { ...baselineErrorOverrides(t), CONFLICT: tClaim("error.code.conflict") },
 *     { fallback: t("generic") })
 *
 * `t` must be bound to the `web-errors` namespace (`useT("web-errors")`).
 */
export function baselineErrorOverrides(
  t: (key: string) => string,
): Partial<Record<ErrorCode, string>> {
  const out: Partial<Record<ErrorCode, string>> = {}
  for (const code of BASELINE_CODES) {
    out[code as ErrorCode] = t(`code.${code}`)
  }
  return out
}

/** The shared, localized generic fallback line. `t` bound to the `web-errors` namespace. */
export function genericErrorMessage(t: (key: string) => string): string {
  return t("generic")
}
