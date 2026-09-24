"use client"

import * as React from "react"

import { UNSUBSCRIBE_TOKEN_MAX, UNSUBSCRIBE_TOKEN_MIN } from "@civfix/shared"
import { Trans, useT } from "@civfix/ui/i18n"

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
  const { t } = useT("web-unsubscribe")
  const [phase, setPhase] = React.useState<Phase>("working")
  const started = React.useRef(false)

  // The ref keeps this to one request under StrictMode's effect replay. There is deliberately no
  // cancel-on-cleanup: the replay's cleanup would drop the only request's answer and leave the page on
  // "Unsubscribing" forever, and a setState after unmount is a no-op.
  React.useEffect(() => {
    if (started.current) return
    started.current = true

    const token = unsubscribeTokenFromSearch(window.location.search)
    if (token === null) {
      setPhase("unusable")
      return
    }

    api
      .unsubscribeBroadcasts({ token })
      .then(() => setPhase("done"))
      .catch(() => setPhase("unusable"))
  }, [])

  return (
    <main className="unsub-page">
      <div className="unsub-shell" aria-live="polite">
        {phase === "working" ? (
          <>
            <h1>{t("working.title")}</h1>
            <p>{t("working.body")}</p>
          </>
        ) : null}

        {phase === "done" ? (
          <>
            <h1>{t("done.title")}</h1>
            <p>{t("done.body")}</p>
          </>
        ) : null}

        {phase === "unusable" ? (
          <>
            <h1>{t("unusable.title")}</h1>
            <p>{t("unusable.body")}</p>
          </>
        ) : null}

        <p>
          <Trans
            t={t}
            i18nKey="settings_prompt"
            components={[<a key="settings" href="/notifications/prefs" />]}
          />
        </p>
      </div>
    </main>
  )
}
