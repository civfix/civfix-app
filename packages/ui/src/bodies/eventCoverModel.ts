import { ErrorCode, byErrorCode, type ErrorCodeTable } from "@civfix/shared"

const EVENT_COVER_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.MEDIA_REJECTED]: "cover.error_rejected",
  [ErrorCode.RATE_LIMITED]: "cover.error_rate_limited",
}

export function eventCoverErrorKey(code: string | undefined): string {
  return byErrorCode(code, EVENT_COVER_ERROR_KEYS, "cover.error_generic")
}

export interface EventCoverState {
  coverMediaId: string | null
  coverPreviewUrl: string | null
}

export function eventCoverChanged(
  form: EventCoverState,
  existingCoverUrl: string | null | undefined,
): boolean {
  if (form.coverMediaId !== null) return true
  return (existingCoverUrl ?? null) !== null && form.coverPreviewUrl === null
}
