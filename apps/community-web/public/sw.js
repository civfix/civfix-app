// civfix's service worker: it shows web push notifications and opens them. It has no fetch handler, so the
// site's requests never pass through it. Plain JavaScript copied into the export as is: it imports nothing.
"use strict"

const ICON = "/apple-touch-icon.png"
// Both names are shared with src/push/notification-clicks.ts, which marks the clicked notification read.
const CLICK_MESSAGE = "civfix:notification-click"
const READ_PARAM = "readNotification"

// The rule of src/lib/safe-path.ts (isSafeInternalPath), which a worker cannot import: only an absolute
// in-app path, never a scheme, a host, or a scheme-relative "//host" or "/\host".
function isSafeInternalPath(link) {
  if (typeof link !== "string") return false
  if (link !== link.trim()) return false
  if (!link.startsWith("/")) return false
  if (link.startsWith("//") || link.startsWith("/\\")) return false
  return true
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null
}

// The backend's web push body is { title, body?, link?, tag, data }, `data` being encodePushMessageData's
// flat string map, which leaves out a null category or link.
function readPush(event) {
  if (!event.data) return null
  let payload
  try {
    payload = event.data.json()
  } catch {
    return null
  }
  if (payload === null || typeof payload !== "object" || typeof payload.title !== "string") return null
  const data = payload.data !== null && typeof payload.data === "object" ? payload.data : {}
  const notificationId = stringOrNull(data.notificationId) ?? stringOrNull(payload.tag)
  if (notificationId === null) return null
  return {
    title: payload.title,
    body: stringOrNull(payload.body),
    notificationId,
    category: stringOrNull(data.category),
    link: stringOrNull(data.link) ?? stringOrNull(payload.link),
  }
}

// No fetch handler means nothing to keep an old version for: a new worker takes over open tabs at once,
// and claiming them is what lets a click navigate a tab opened before the worker was installed.
self.addEventListener("install", () => {
  void self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  const push = readPush(event)
  if (push === null) return
  const options = {
    tag: push.notificationId,
    icon: ICON,
    data: { notificationId: push.notificationId, category: push.category, link: push.link },
  }
  if (push.body !== null) options.body = push.body
  event.waitUntil(self.registration.showNotification(push.title, options))
})

function readUrl(path, notificationId) {
  const url = new URL(path, self.location.origin)
  url.searchParams.set(READ_PARAM, notificationId)
  return url.href
}

async function openNotification(data) {
  const notificationId = data !== null && typeof data === "object" ? stringOrNull(data.notificationId) : null
  const link = notificationId !== null && isSafeInternalPath(data.link) ? data.link : null
  const message = { type: CLICK_MESSAGE, notificationId }
  const windows = await self.clients.matchAll({ type: "window" })
  const open = windows.find((client) => client.focused) ?? windows[0]

  if (open === undefined) {
    // A new tab cannot be told by message before its page listens, so the id rides in the URL instead.
    if (link !== null) return self.clients.openWindow(readUrl(link, notificationId))
    return self.clients.openWindow(notificationId !== null ? readUrl("/", notificationId) : "/")
  }

  const focused = await open.focus()
  if (link === null) {
    if (notificationId !== null) focused.postMessage(message)
    return
  }
  // The navigation reloads the page, so the URL carries the id for the new page; the message reaches it
  // too when it already listens, and the page marks each id once.
  const navigated = await focused.navigate(readUrl(link, notificationId))
  if (navigated) navigated.postMessage(message)
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(openNotification(event.notification.data))
})
