"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarX2, CheckCircle2, Loader2, SearchX } from "lucide-react"

import { DetailShell } from "@/components/detail-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { readGuestManageToken } from "@/features/guest/guest-cancel-token"

type Phase = "confirm" | "cancelling" | "done" | "error"

export function GuestCancelView() {
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
      setError(cancelErrorMessage(err))
      setPhase("error")
    }
  }, [token])

  if (!token && phase === "confirm") {
    return (
      <DetailShell>
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="This link doesn't work"
          body="The cancellation link is incomplete. Open the link from your confirmation email or text exactly as it was sent, or ask the host to take you off the list."
          action={
            <Button variant="outline" onClick={goHome}>
              Go to the map
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
          <h1 className="font-display text-token-30 font-extrabold text-ink">
            Your RSVP is cancelled
          </h1>
          <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">
            You are off the guest list and the host has been told. You can RSVP again any time from the
            event page.
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={goHome}>Go to the map</Button>
          </div>
        </div>
      ) : phase === "cancelling" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-token-15 text-ink-2">Cancelling your RSVP...</p>
        </div>
      ) : phase === "error" ? (
        <EmptyState
          title="We couldn't cancel that RSVP"
          body={error ?? "Something went wrong. Please try again."}
          action={
            <Button variant="outline" onClick={() => void cancelRsvp()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-bloom-50 text-primary">
            <CalendarX2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="font-display text-token-30 font-extrabold text-ink">Cancel your RSVP?</h1>
          <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">
            This takes you off the guest list for the event in your confirmation message and lets the
            host know. You will stop getting updates about it.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button variant="destructive" onClick={() => void cancelRsvp()}>
              Cancel my RSVP
            </Button>
            <Button variant="outline" onClick={goHome}>
              Keep my RSVP
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
  window.history.replaceState(null, "", window.location.pathname)
}

function cancelErrorMessage(err: unknown): string {
  return errorMessage(
    err,
    {
      NOT_FOUND: "We couldn't find that RSVP. The link may have expired, or the event may be over.",
      VALIDATION: "This cancellation link looks incorrect or has expired.",
      RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
    },
    { fallback: "We couldn't reach civfix to cancel this RSVP. Check your connection and try again." },
  )
}
