"use client"

import * as React from "react"

import { UNSUBSCRIBE_TOKEN_MAX, UNSUBSCRIBE_TOKEN_MIN } from "@civfix/shared"

import { api } from "@/lib/api"

export function unsubscribeTokenFromSearch(search: string | null | undefined): string | null {
  const value = new URLSearchParams(search ?? "").get("t")
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length < UNSUBSCRIBE_TOKEN_MIN || trimmed.length > UNSUBSCRIBE_TOKEN_MAX
    ? null
    : trimmed
}

type Phase = "working" | "done" | "unusable"

export function UnsubscribeView() {
  const [phase, setPhase] = React.useState<Phase>("working")
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true

    const token = unsubscribeTokenFromSearch(window.location.search)
    if (token === null) {
      setPhase("unusable")
      return
    }

    let cancelled = false
    api
      .unsubscribeBroadcasts({ token })
      .then(() => {
        if (!cancelled) setPhase("done")
      })
      .catch(() => {
        if (!cancelled) setPhase("unusable")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="unsub-page">
      <div className="unsub-shell" aria-live="polite">
        {phase === "working" ? (
          <>
            <h1>Unsubscribing…</h1>
            <p>One moment.</p>
          </>
        ) : null}

        {phase === "done" ? (
          <>
            <h1>You&rsquo;re unsubscribed from this event&rsquo;s messages.</h1>
            <p>
              You will not get any more updates from the host of this event. You may still receive a
              notice if the event is cancelled, because that is something you need to know about an
              event you signed up for.
            </p>
          </>
        ) : null}

        {phase === "unusable" ? (
          <>
            <h1>We couldn&rsquo;t use this link</h1>
            <p>
              This unsubscribe link could not be completed, so we cannot tell you that it worked. Some
              mail apps shorten or wrap long links; try opening the link from the original email again,
              or use the button below.
            </p>
          </>
        ) : null}

        <p>
          To change what civfix sends you generally, open{" "}
          <a href="/notifications/prefs">notification settings</a>.
        </p>
      </div>
    </main>
  )
}
