import { ErrorCode, errorCopyKey } from "@civfix/shared"

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
  return errorCopyKey(
    err,
    {
      [ErrorCode.RATE_LIMITED]: PROFILE_SAVE_RATE_LIMITED_KEY,
      [ErrorCode.VALIDATION]: validationKey,
    },
    genericKey,
  )
}
