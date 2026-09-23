"use client"

import * as React from "react"
import { useToast } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

import { retrySignOut } from "@/hooks/use-auth"
import { useSignOutRetryStore } from "@/store/sign-out-retry-store"

/**
 * Surfaces a failed sign-out. useLogout runs above the toast and i18n providers, so it records the
 * failure in a store and this component, mounted inside them, turns it into a toast with a retry.
 */
export function SignOutFailureToast(): null {
  const { t } = useT("web-auth")
  const toast = useToast()
  const failures = useSignOutRetryStore((s) => s.failures)
  const shown = React.useRef(failures)

  React.useEffect(() => {
    if (failures === shown.current) return
    shown.current = failures
    toast.show(t("sign_out_failed.message"), {
      variant: "error",
      action: { label: t("sign_out_failed.retry"), onPress: () => void retrySignOut() },
    })
  }, [failures, t, toast])

  return null
}
