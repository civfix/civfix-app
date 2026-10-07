import type { TFunction } from "i18next"
import { ErrorCode, appErrorCode, appErrorFields, byErrorCode, type ErrorCodeTable } from "@civfix/shared"

const TEXT_FIELDS: ReadonlySet<string> = new Set(["title", "description", "addr"])

const SUBMIT_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.GPS_IMPLAUSIBLE]: "errors.validation",
  [ErrorCode.RATE_LIMITED]: "errors.rate_limited",
  [ErrorCode.TURNSTILE_FAILED]: "errors.turnstile_failed",
  [ErrorCode.MEDIA_REJECTED]: "errors.media_rejected",
  [ErrorCode.UNAUTHORIZED]: "errors.unauthorized",
  [ErrorCode.FORBIDDEN]: "errors.unauthorized",
}

/** The keys are bare, so `t` must be bound to the report-wizard namespace. */
export function submitErrorMessage(err: unknown, t: TFunction): string {
  const code = appErrorCode(err)
  if (code === ErrorCode.VALIDATION) {
    const fieldKeys = Object.keys(appErrorFields(err) ?? {}).map((key) => key.split(".")[0])
    if (fieldKeys.some((key) => key !== undefined && TEXT_FIELDS.has(key))) return t("errors.validation_text")
    if (fieldKeys.includes("mediaUploadIds")) return t("errors.validation_media")
    return t("errors.validation")
  }
  return t(byErrorCode(code, SUBMIT_ERROR_KEYS, "errors.generic"))
}
