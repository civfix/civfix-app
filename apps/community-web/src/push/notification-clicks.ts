import { api } from "@/lib/api"
import { replaceUrlInPlace } from "@/lib/replace-url"
import { warnPush } from "@/push/log"

// Both names are shared with public/sw.js, which sends them on a notification click.
const CLICK_MESSAGE = "civfix:notification-click"
const READ_PARAM = "readNotification"

// A navigated tab can get the id both in its URL and by message; it is marked read once per page.
const marked = new Set<string>()

function markClicked(notificationId: string): void {
  if (notificationId.length === 0 || marked.has(notificationId)) return
  marked.add(notificationId)
  api.markNotificationsRead({ ids: [notificationId] }).catch((err: unknown) => {
    marked.delete(notificationId)
    warnPush("marking a clicked notification read", err)
  })
}

/** A page the worker opened for a click carries the notification's id; it leaves the address bar here. */
export function takeClickFromUrl(): void {
  const url = new URL(window.location.href)
  const notificationId = url.searchParams.get(READ_PARAM)
  if (notificationId === null) return
  url.searchParams.delete(READ_PARAM)
  replaceUrlInPlace(`${url.pathname}${url.search}${url.hash}`)
  markClicked(notificationId)
}

export function listenForClicks(container: ServiceWorkerContainer): () => void {
  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { type?: unknown; notificationId?: unknown } | null
    if (data?.type === CLICK_MESSAGE && typeof data.notificationId === "string") markClicked(data.notificationId)
  }
  container.addEventListener("message", onMessage)
  return () => container.removeEventListener("message", onMessage)
}
