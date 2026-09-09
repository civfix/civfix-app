"use client"

import { ChatSocketCore, type WsConnection } from "@civfix/ui/realtime"

import { API_BASE_URL } from "@/lib/api"

/**
 * The single, always-on WebSocket to the API (`GET /ws`, cookie-authenticated, same-origin handshake).
 *
 * One socket multiplexes BOTH concerns the app has over the wire:
 *  - per-user invalidate SIGNALS ({type:"signal"}) that the realtime channel turns into query
 *    invalidations (held open app-wide while the viewer is authenticated, via connect()/disconnect());
 *  - chat ROOM frames (message/ack/presence/typing) for whichever conversations are open (rooms are
 *    joined/left over this same socket, refcounted by the chat screens via retain()/release()).
 *
 * The client itself - desired/rejected rooms, schema validation of every frame, the send queue, the
 * shared `nextBackoffMs` reconnect schedule, refcounting and auto-rejoin - is the SHARED
 * `ChatSocketCore` (@civfix/ui/realtime), which both community apps run. It already implements the
 * `ChatSocketLike` surface the shared data context consumes, so `chatSocket` is handed to the provider
 * directly (no per-host adapter). This module owns only what is web-specific:
 *
 *  - the TRANSPORT: deriving the ws URL from the HTTP API base and constructing a browser WebSocket. The
 *    handshake authenticates from the same-origin session COOKIE, so there is nothing to resolve
 *    asynchronously and no client-side identity key (contrast mobile's ?ticket=/?token= client).
 *  - the web behavior choices: frames sent while the socket is down are QUEUED and flushed on the next
 *    open (the composer relies on it), and a `disconnect()` must not tear a socket out from under a live
 *    chat screen (`teardownPolicy: "intent"`), because this one socket is shared with the always-on
 *    signals channel.
 *
 * Static-export / SSR safety: the transport only touches `window`/`WebSocket` when the core asks it to
 * open (from an effect, browser-only), and returns null when there is no window - which, with
 * `retryWhenUnavailable` left off, leaves the socket closed rather than spinning a retry timer during the
 * export/prerender. Importing this module and referencing the `chatSocket` singleton does no I/O.
 */

/**
 * Derive the WebSocket URL from the HTTP API base. `http://host:8080` -> `ws://host:8080/ws`,
 * `https://host` -> `wss://host/ws`. Returns "" when called without a window (export/prerender) so the
 * socket stays inert until it runs in the browser.
 */
export function wsUrlFromApiBase(apiBase: string = API_BASE_URL): string {
  if (typeof window === "undefined") return ""
  const trimmed = apiBase.replace(/\/+$/, "")
  let url: URL
  try {
    // Resolve relative bases (e.g. "/api") against the current origin.
    url = new URL(trimmed, window.location.origin)
  } catch {
    return ""
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  // Preserve any base path, then append the /ws upgrade endpoint.
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws`
  url.search = ""
  url.hash = ""
  return url.toString()
}

/** Browsers expose WebSocket on window; treat its absence (export/SSR) as "cannot connect". */
function hasWebSocket(): boolean {
  return typeof window !== "undefined" && typeof window.WebSocket === "function"
}

/**
 * Open a browser WebSocket to the API. The URL is resolved LAZILY here (never at module import): the
 * singleton is constructed during the static-export prerender, which has no `window`, so a
 * construction-time resolution would freeze an empty URL and the socket would never connect after
 * hydration. Returning null means "cannot connect here" - the core goes closed and waits for the next
 * explicit connect()/retain().
 */
function openWebSocket(): WsConnection | null {
  const url = wsUrlFromApiBase()
  if (!url || !hasWebSocket()) return null
  // Construction can throw on a malformed URL; the core treats a throw as a failed attempt and backs off.
  return { socket: new window.WebSocket(url) }
}

/** The single shared socket used by the realtime channel and every open conversation. */
export const chatSocket = new ChatSocketCore({
  transport: { open: openWebSocket },
  // Queue-and-flush: the composer sends optimistically and relies on the frame landing on reconnect.
  queueWhileClosed: true,
  // The socket is shared with the always-on signals channel, so a release()/disconnect() may only tear it
  // down when NOTHING else wants it.
  teardownPolicy: "intent",
  onInvalidFrame: (direction, issues) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ws] dropping invalid ${direction} frame`, issues)
    }
  },
})
