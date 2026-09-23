"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"

import { Button } from "@/components/ui/button"
import { useLogout } from "@/hooks/use-auth"
import { useSignOutRetryStore } from "@/store/sign-out-retry-store"

/**
 * A failed sign-out leaves the session cookie valid, so the user is still signed in. This stays on
 * screen (a toast would time out or be replaced by the next one) until they retry or dismiss it.
 */
export function SignOutFailureNotice(): React.ReactElement | null {
  const { t } = useT("web-auth")
  const logout = useLogout()
  const failed = useSignOutRetryStore((s) => s.failed)
  const pending = useSignOutRetryStore((s) => s.pending)
  const dismiss = useSignOutRetryStore((s) => s.dismiss)

  if (!failed) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-token-4 z-[100] mx-auto flex w-[min(460px,calc(100vw-32px))] items-center gap-token-3 rounded-md border border-ink-5 bg-cardflat px-token-4 py-token-3 text-token-14 text-ink shadow-s1"
    >
      <p className="min-w-0 flex-1">{t("sign_out_failed.message")}</p>
      <Button size="sm" disabled={pending} onClick={() => void logout()}>
        {t("sign_out_failed.retry")}
      </Button>
      <Button variant="ghost" size="sm" onClick={dismiss}>
        {t("close")}
      </Button>
    </div>
  )
}
