"use client"

import { useCallback } from "react"
import { ErrorCode } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { errorMessage } from "@/lib/error-messages"

export type ErrorOverrides = Partial<Record<ErrorCode, string>>

export interface ConsoleErrorCopy {
  base: ErrorOverrides
  message: (err: unknown, overrides?: ErrorOverrides) => string
}

export function useConsoleErrors(): ConsoleErrorCopy {
  const { t } = useT("host-common")

  const base: ErrorOverrides = {
    [ErrorCode.VALIDATION]: t("error.validation"),
    [ErrorCode.RATE_LIMITED]: t("error.rate_limited"),
    [ErrorCode.UNAUTHORIZED]: t("error.unauthorized"),
    [ErrorCode.FORBIDDEN]: t("error.forbidden"),
    [ErrorCode.CONFLICT]: t("error.conflict"),
    [ErrorCode.NOT_FOUND]: t("error.not_found"),
    [ErrorCode.ABUSE_HELD]: t("error.abuse_held"),
  }

  const message = useCallback(
    (err: unknown, overrides?: ErrorOverrides) =>
      errorMessage(err, { ...base, ...(overrides ?? {}) }, { fallback: t("error.generic") }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  return { base, message }
}
