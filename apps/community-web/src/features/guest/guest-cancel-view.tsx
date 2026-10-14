"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarX2, CheckCircle2, Loader2, SearchX } from "lucide-react"

import { useT } from "@civfix/ui/i18n"

import { DetailShell } from "@/components/detail-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { replaceUrlInPlace } from "@/lib/replace-url"
import { readGuestManageToken } from "@/features/guest/guest-cancel-token"

type Phase = "confirm" | "cancelling" | "done" | "error"

export function GuestCancelView() {
  const { t } = useT("web-guest-cancel")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = readGuestManageToken(searchParams.get("token"))

  const [phase, setPhase] = React.useState<Phase>("confirm")
  const [error, setError] = React.useState<string | null>(null)
  const requestSeq = React.useRef(0)

  const goHome = React.useCallback(() => router.push("/"), [router])

  const cancelRsvp = React.useCallback(async () => {
    if (!token) return
    const seq = ++requestSeq.current
    setPhase("cancelling")
    setError(null)
    try {
      await api.guestRsvpCancel({ token })
      if (requestSeq.current !== seq) return
      setPhase("done")
      scrubTokenFromUrl()
    } catch (err) {
      if (requestSeq.current !== seq) return
      setError(cancelErrorMessage(err, t))
      setPhase("error")
    }
  }, [token, t])

  if (!token && phase === "confirm") {
    return (
      <DetailShell>
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title={t("invalid.title")}
          titleAs="h1"
          body={t("invalid.body")}
          action={
            <Button variant="outline" onClick={goHome}>
              {t("invalid.action")}
            </Button>
          }
        />
      </DetailShell>
    )
  }

  return (
    <DetailShell>
      {phase === "done" ? (
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-moss-100 text-moss-600">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="font-display text-token-30 font-extrabold text-ink">{t("done.title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">{t("done.body")}</p>
          <div className="mt-6 flex justify-center">
            <Button onClick={goHome}>{t("done.action")}</Button>
          </div>
        </div>
      ) : phase === "cancelling" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-token-15 text-ink-2">{t("cancelling")}</p>
        </div>
      ) : phase === "error" ? (
        <EmptyState
          title={t("error.title")}
          titleAs="h1"
          body={error ?? t("error.fallback")}
          action={
            <Button variant="outline" onClick={() => void cancelRsvp()}>
              {t("error.retry")}
            </Button>
          }
        />
      ) : (
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-bloom-50 text-primary">
            <CalendarX2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="font-display text-token-30 font-extrabold text-ink">{t("confirm.title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">{t("confirm.body")}</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button variant="destructive" onClick={() => void cancelRsvp()}>
              {t("confirm.cancel")}
            </Button>
            <Button variant="outline" onClick={goHome}>
              {t("confirm.keep")}
            </Button>
          </div>
        </div>
      )}
    </DetailShell>
  )
}

/**
 * Drop the manage token from the address bar once it has been spent. It is a bearer capability for this
 * RSVP, and leaving it in the URL keeps it in screenshots, shared links and session history. Runs AFTER
 * the success phase is set, and the invalid-link branch is gated on the confirm phase, so the scrubbed
 * query does not bounce the settled page back to "this link doesn't work".
 */
function scrubTokenFromUrl(): void {
  if (typeof window === "undefined") return
  replaceUrlInPlace(window.location.pathname)
}

function cancelErrorMessage(err: unknown, t: (key: string) => string): string {
  return errorMessage(
    err,
    {
      NOT_FOUND: t("error.notFound"),
      VALIDATION: t("error.validation"),
      RATE_LIMITED: t("error.rateLimited"),
    },
    { fallback: t("error.network") },
  )
}
