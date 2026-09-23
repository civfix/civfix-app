import type { ErrorCode } from "@civfix/shared"

import { toAppError } from "@/lib/api"

/**
 * Errors map by code, never by message: raw server text never surfaces. This is a plain (non-hook)
 * helper, so the caller passes already-localized copy through `overrides` and `fallback`.
 * `preferServerMessage` has no effect; it stays in the options type so existing call sites compile.
 */
export function errorMessage(
  err: unknown,
  overrides: Partial<Record<ErrorCode, string>> = {},
  opts: { fallback?: string; preferServerMessage?: boolean } = {},
): string {
  // The `web-errors:generic_fallback` default, a last resort for tests and non-localized call sites;
  // localized UI passes genericErrorMessage(t).
  const { fallback = "Something went wrong. Please try again." } = opts
  const e = toAppError(err)
  const override = overrides[e.code]
  if (override !== undefined) return override
  return fallback
}

const BASELINE_CODES = [
  "VALIDATION",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CONFLICT",
  "NOT_FOUND",
  "TURNSTILE_FAILED",
] as const

/** `t` must be bound to the `web-errors` namespace. */
export function baselineErrorOverrides(
  t: (key: string) => string,
): Partial<Record<ErrorCode, string>> {
  const out: Partial<Record<ErrorCode, string>> = {}
  for (const code of BASELINE_CODES) {
    out[code as ErrorCode] = t(`code.${code}`)
  }
  return out
}

/** `t` must be bound to the `web-errors` namespace. */
export function genericErrorMessage(t: (key: string) => string): string {
  return t("generic")
}
