import { AppError, ErrorCode } from "@civfix/shared"

type Translate = (key: string, options?: Record<string, unknown>) => string

const KNOWN_CODES: ReadonlySet<string> = new Set<string>([
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
])

export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AppError" &&
    typeof (err as { code?: unknown }).code === "string" &&
    typeof (err as { message?: unknown }).message === "string"
  )
}

export function friendlyError(t: Translate, err: unknown): string {
  if (isAppError(err) && KNOWN_CODES.has(err.code)) {
    return t(`mobile-errors:code.${err.code}`)
  }
  return t("mobile-errors:generic")
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
  if (isAppError(err)) return friendlyError(t, err)
  if (isNetworkError(err)) return t("mobile-errors:generic")
  return t("mobile-errors:oauth_failed", { provider })
}

export function errorMessage(err: unknown, fallback: string): string {
  if (isAppError(err) && err.message && err.message.length < 160) return err.message
  return fallback
}

export function isUnauthorized(err: unknown): boolean {
  return isAppError(err) && err.code === ErrorCode.UNAUTHORIZED
}

export function isRateLimited(err: unknown): boolean {
  return isAppError(err) && err.code === ErrorCode.RATE_LIMITED
}

export function isConflict(err: unknown): boolean {
  if (!isAppError(err)) return false
  return err.code === ErrorCode.CONFLICT || err.httpStatus === 409
}

const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set<string>([
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
])

export function isRetryableError(err: unknown): boolean {
  return !(isAppError(err) && NON_RETRYABLE_CODES.has(err.code))
}
