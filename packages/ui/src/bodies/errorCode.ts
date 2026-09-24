/**
 * appErrorCode - read the AppError code off an unknown error.
 *
 * Shared by the bodies that map an AppError onto inline copy (CreateCleanupBody / EditCleanupBody /
 * DeleteAccountModal / ProfileBody). The structural-clone fallback is deliberate and VERBATIM: the error
 * may arrive as a CROSS-REALM structural clone (so `err instanceof AppError` is false even though it is
 * one), in which case we recognise it by its `name === "AppError"` and read `.code` off the clone. When it
 * is neither a real nor a cloned AppError the code is `undefined`.
 *
 * Platform-neutral pure logic (no expo/maplibre/DOM), so it is safe to share across the .web/.native line.
 */
import { AppError } from "@civfix/shared"

/** The AppError code off an unknown error (handles a structurally-cloned AppError too). */
export function appErrorCode(err: unknown): string | undefined {
  return err instanceof AppError
    ? err.code
    : typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AppError"
      ? (err as { code?: string }).code
      : undefined
}

/**
 * The AppError `fields` map off an unknown error (same structural-clone tolerance as appErrorCode).
 * The server names the offending key there, which is how a refusal can be told apart from a generic
 * failure of the same code - see `guestSmsUnavailable`.
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
