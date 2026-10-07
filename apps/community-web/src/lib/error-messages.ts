import { errorCopyKey, type ErrorCodeTable } from "@civfix/shared"

/**
 * Errors map by code, never by message: raw server text never surfaces. This is a plain (non-hook)
 * helper, so the caller passes already-localized copy through `overrides` and `fallback`.
 */
export function errorMessage(
  err: unknown,
  overrides: ErrorCodeTable<string> = {},
  opts: { fallback?: string } = {},
): string {
  // A last resort for tests and non-localized call sites;
  // localized UI passes its own fallback.
  const { fallback = "Something went wrong. Please try again." } = opts
  return errorCopyKey(err, overrides, fallback)
}
