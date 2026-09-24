// An AppError can arrive as a cross-realm structural clone, where `instanceof AppError` is false, so it
// is also recognised by `name === "AppError"`.
import { AppError } from "@civfix/shared"

export function appErrorCode(err: unknown): string | undefined {
  return err instanceof AppError
    ? err.code
    : typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AppError"
      ? (err as { code?: string }).code
      : undefined
}

/**
 * The server names the offending key in `fields`, which is how a refusal can be told apart from a
 * generic failure of the same code (see `guestSmsUnavailable`).
 */
export function appErrorFields(err: unknown): Record<string, string> | undefined {
  const fields =
    err instanceof AppError
      ? err.fields
      : typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AppError"
        ? (err as { fields?: Record<string, string> }).fields
        : undefined
  return typeof fields === "object" && fields !== null ? fields : undefined
}

export const EVENT_ENDED_FIELD = "event"

export const EVENT_ENDED_REASON = "ended"

export function isEventEndedRefusal(fields: Record<string, string> | undefined): boolean {
  return fields?.[EVENT_ENDED_FIELD] === EVENT_ENDED_REASON
}

export const PROFILE_SAVE_RATE_LIMITED_KEY = "settings-account:save_error.rate_limited"

export const PROFILE_SAVE_VALIDATION_KEY = "settings-account:save_error.validation"

/**
 * The copy key for a failed Settings > Account profile save. A throttle or a server-side refusal must
 * not read as "try again", which is the generic key's promise.
 */
export function profileSaveErrorKey(
  err: unknown,
  genericKey: string,
  validationKey: string = PROFILE_SAVE_VALIDATION_KEY,
): string {
  switch (appErrorCode(err)) {
    case "RATE_LIMITED":
      return PROFILE_SAVE_RATE_LIMITED_KEY
    case "VALIDATION":
      return validationKey
    default:
      return genericKey
  }
}
