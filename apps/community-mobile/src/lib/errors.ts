import {
  ERROR_HTTP_STATUS,
  ErrorCode,
  appErrorCode,
  errorCopyKey,
  isAppErrorLike,
  type ErrorCodeTable,
} from "@civfix/shared"

type Translate = (key: string, options?: Record<string, unknown>) => string

const LOCALIZED_CODES: readonly ErrorCode[] = [
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
  ErrorCode.RATE_LIMITED,
  ErrorCode.ABUSE_HELD,
  ErrorCode.GPS_IMPLAUSIBLE,
  ErrorCode.MEDIA_REJECTED,
  ErrorCode.CONFLICT,
  ErrorCode.TURNSTILE_FAILED,
  ErrorCode.INTERNAL,
]

const ERROR_COPY_KEYS: ErrorCodeTable<string> = Object.fromEntries(
  LOCALIZED_CODES.map((code) => [code, `mobile-errors:code.${code}`]),
)

export function friendlyError(t: Translate, err: unknown): string {
  return t(errorCopyKey(err, ERROR_COPY_KEYS, "mobile-errors:generic"))
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const message =
    typeof err === "object" &&
    err !== null &&
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : ""
  return /network request failed|failed to fetch|network error/i.test(message)
}

export function oauthError(t: Translate, provider: "Apple" | "Google", err: unknown): string {
  if (isAppErrorLike(err)) return friendlyError(t, err)
  if (isNetworkError(err)) return t("mobile-errors:generic")
  return t("mobile-errors:oauth_failed", { provider })
}

/**
 * The server's message text is English-only, so a rejected code reads as the caller's localized
 * `rejected` copy and every other failure as its localized code copy; raw server text never shows.
 */
export function codeRejectionReason(t: Translate, err: unknown, rejected: string): string {
  if (isUnauthorized(err)) return rejected
  return friendlyError(t, err)
}

export function isUnauthorized(err: unknown): boolean {
  return appErrorCode(err) === ErrorCode.UNAUTHORIZED
}

export function isRateLimited(err: unknown): boolean {
  return appErrorCode(err) === ErrorCode.RATE_LIMITED
}

export function isConflict(err: unknown): boolean {
  if (!isAppErrorLike(err)) return false
  return err.code === ErrorCode.CONFLICT || err.httpStatus === ERROR_HTTP_STATUS[ErrorCode.CONFLICT]
}

const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set<string>([
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
])

export function isRetryableError(err: unknown): boolean {
  const code = appErrorCode(err)
  return code === undefined || !NON_RETRYABLE_CODES.has(code)
}
