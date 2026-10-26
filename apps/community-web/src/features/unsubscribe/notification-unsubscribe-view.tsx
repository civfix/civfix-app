"use client"

import * as React from "react"

import { Trans, useT } from "@civfix/ui/i18n"

import { useNotificationUnsubscribe } from "./notification-unsubscribe"

export function NotificationUnsubscribeView() {
  const { t } = useT("web-unsubscribe")
  const { t: tPrefs } = useT("notifications-prefs")
  const state = useNotificationUnsubscribe()

  return (
    <main className="unsub-page">
      <div className="unsub-shell" aria-live="polite" aria-busy={state.phase === "checking"}>
        {state.phase === "checking" ? (
          <div className="unsub-skeleton" role="status" aria-label={t("notifications.checking")}>
            <span />
            <span />
          </div>
        ) : null}

        {state.phase === "done" ? (
          <h1>
            <Trans
              t={t}
              i18nKey="notifications.done"
              values={{ category: tPrefs(`category.${state.category}.label`) }}
              components={{ strong: <strong /> }}
            />
          </h1>
        ) : null}

        {state.phase === "unusable" ? <h1>{t("notifications.unusable")}</h1> : null}

        {state.phase === "checking" ? null : (
          <p>
            <a href="/notifications/prefs">{t("notifications.manage")}</a>
          </p>
        )}
      </div>
    </main>
  )
}
