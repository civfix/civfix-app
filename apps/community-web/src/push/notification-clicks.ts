import { api } from "@/lib/api"
import { replaceUrlInPlace } from "@/lib/replace-url"
import { warnPush } from "@/push/log"

// Both names are shared with public/sw.js, which sends them on a notification click.
const CLICK_MESSAGE = "civfix:notification-click"
const READ_PARAM = "readNotification"

// A navigated tab can get the id both in its URL and by message; it is marked read once per page.
const marked = new Set<string>()
// Clicks that arrived before a signed-in session could mark them.
const pending = new Set<string>()
let marking = false

function markClicked(notificationId: string): void {
  if (marked.has(notificationId)) return
  marked.add(notificationId)
  api.markNotificationsRead({ ids: [notificationId] }).catch((err: unknown) => {
    marked.delete(notificationId)
    warnPush("marking a clicked notification read", err)
  })
}

function received(notificationId: string): void {
  if (notificationId.length === 0) return
  if (marking) markClicked(notificationId)
  else pending.add(notificationId)
}

function onMessage(event: MessageEvent<unknown>): void {
  const data = event.data as { type?: unknown; notificationId?: unknown } | null
  if (data?.type === CLICK_MESSAGE && typeof data.notificationId === "string")
    received(data.notificationId)
}

// Read when the providers import this module, before anything renders: the shell's first URL write
// (web-nav-controller's mount) drops the query, and a page the worker just opened is told by message
// as early as it listens.
if (typeof window !== "undefined") {
  const notificationId = new URL(window.location.href).searchParams.get(READ_PARAM)
  if (notificationId !== null) received(notificationId)
  navigator.serviceWorker?.addEventListener("message", onMessage)
}

/** Marks the clicks this page was opened or told about, now and until the returned function is called. */
export function startMarkingClicks(): () => void {
  const url = new URL(window.location.href)
  if (url.searchParams.has(READ_PARAM)) {
    url.searchParams.delete(READ_PARAM)
    replaceUrlInPlace(`${url.pathname}${url.search}${url.hash}`)
  }
  marking = true
  for (const notificationId of pending) markClicked(notificationId)
  pending.clear()
  return () => {
    marking = false
  }
}
