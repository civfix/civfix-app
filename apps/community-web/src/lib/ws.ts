"use client"

import { ChatSocketCore, type WsConnection } from "@civfix/ui/realtime"

import { API_BASE_URL } from "@/lib/api"

/**
 * One socket carries both the per-user invalidate signals and the chat room frames; the client logic is
 * the shared `ChatSocketCore`. The handshake authenticates from the same-origin session cookie, so there
 * is no client-side identity key (unlike mobile's ticket/token client).
 *
 * The transport touches `window` only when the core asks it to open, from a browser effect, and returns
 * null without a window; with `retryWhenUnavailable` off, the socket stays closed during the static
 * export instead of spinning a retry timer. Importing this module does no I/O.
 */

export function wsUrlFromApiBase(apiBase: string = API_BASE_URL): string {
  if (typeof window === "undefined") return ""
  const trimmed = apiBase.replace(/\/+$/, "")
  let url: URL
  try {
    url = new URL(trimmed, window.location.origin)
  } catch {
    return ""
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws`
  url.search = ""
  url.hash = ""
  return url.toString()
}

function hasWebSocket(): boolean {
  return typeof window !== "undefined" && typeof window.WebSocket === "function"
}

/**
 * The URL is resolved lazily, never at import: the singleton is constructed during the static-export
 * prerender, which has no `window`, so an import-time URL would freeze empty and never connect.
 */
function openWebSocket(): WsConnection | null {
  const url = wsUrlFromApiBase()
  if (!url || !hasWebSocket()) return null
  // Construction can throw on a malformed URL; the core treats a throw as a failed attempt and backs off.
  return { socket: new window.WebSocket(url) }
}

export const chatSocket = new ChatSocketCore({
  transport: { open: openWebSocket },
  // Queue-and-flush: the composer sends optimistically and relies on the frame landing on reconnect.
  queueWhileClosed: true,
  // Shared with the always-on signals channel, so a release()/disconnect() may only tear it down when
  // nothing else wants it.
  teardownPolicy: "intent",
  onInvalidFrame: (direction, issues) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ws] dropping invalid ${direction} frame`, issues)
    }
  },
})
