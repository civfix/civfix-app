import type { TFunction } from "i18next"
import { appErrorCode, appErrorFields } from "../data/errorCode"

const TEXT_FIELDS: ReadonlySet<string> = new Set(["title", "description", "addr"])

/** The copy on the submit error screen, from the report-wizard catalog `t` is bound to. */
export function submitErrorMessage(err: unknown, t: TFunction): string {
  const code = appErrorCode(err)
  const fieldKeys = Object.keys(appErrorFields(err) ?? {}).map((key) => key.split(".")[0])
  switch (code) {
    case "VALIDATION":
      if (fieldKeys.some((key) => key !== undefined && TEXT_FIELDS.has(key))) return t("errors.validation_text")
      if (fieldKeys.includes("mediaUploadIds")) return t("errors.validation_media")
      return t("errors.validation")
    case "GPS_IMPLAUSIBLE":
      return t("errors.validation")
    case "RATE_LIMITED":
      return t("errors.rate_limited")
    case "TURNSTILE_FAILED":
      return t("errors.turnstile_failed")
    case "MEDIA_REJECTED":
      return t("errors.media_rejected")
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("errors.unauthorized")
    default:
      return t("errors.generic")
  }
}
