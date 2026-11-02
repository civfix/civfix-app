"use client"

import * as React from "react"

import type { NotificationCategory } from "@civfix/contract"

import { api } from "@/lib/api"

import { unsubscribeTokenFromSearch } from "./unsubscribe-view"

export type NotificationUnsubscribe =
  { phase: "checking" } | { phase: "done"; category: NotificationCategory } | { phase: "unusable" }

/** POSTs the link's token once, then names the category the server unchecked Email for. */
export function useNotificationUnsubscribe(): NotificationUnsubscribe {
  const [state, setState] = React.useState<NotificationUnsubscribe>({ phase: "checking" })
  const started = React.useRef(false)

  // Same single-request guard as the broadcast page: StrictMode's effect replay must not send it twice.
  React.useEffect(() => {
    if (started.current) return
    started.current = true

    const token = unsubscribeTokenFromSearch(window.location.search)
    if (token === null) {
      setState({ phase: "unusable" })
      return
    }

    api
      .unsubscribeNotificationEmail({ token })
      .then((res) =>
        setState(res.category ? { phase: "done", category: res.category } : { phase: "unusable" }),
      )
      .catch(() => setState({ phase: "unusable" }))
  }, [])

  return state
}
