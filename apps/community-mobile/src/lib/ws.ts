/**
 * The single shared chat/signals WebSocket for the mobile app.
 *
 * The client itself - desired/rejected rooms, schema validation of every frame, the shared
 * `nextBackoffMs` reconnect schedule, refcounting, auto-rejoin - is the SHARED `ChatSocketCore`
 * (@civfix/ui/realtime), which both community apps run. It already implements the `ChatSocketLike`
 * surface the shared data seam consumes, so `chatSocket` is handed to the ApiProvider directly (no
 * host adapter). This module owns only what is NATIVE-specific:
 *
 *  - the TRANSPORT. The handshake credential rides in the URL as a single-use, short-lived `?ticket=`
 *    (see `wsTransport.ts`). The long-lived session bearer never goes in the URL, where it would land in
 *    server/proxy access logs; when the ticket cannot be minted the transport reports "unavailable" and
 *    the core retries on its backoff schedule.
 *  - the EMPTY ORIGIN header. Origin gate (anti-CSWSH, services/api/src/ws/gateway.ts isAllowedWsOrigin):
 *    the backend rejects a WS upgrade whose Origin isn't in WEB_ORIGINS, but ALLOWS a missing/empty
 *    Origin on the cookie-less bearer/native path. RN's WebSocket otherwise auto-sends
 *    `Origin: <the ws URL's origin>` (https://api.civfix.org), which is NOT allow-listed -> close 1008
 *    "origin not allowed". We are a native ticket client (no cookie), so we send an EMPTY Origin to take
 *    the allowed native path. (Web works because browsers send the allow-listed web origin.)
 *  - the APP-STATE cycle: backgrounding closes the socket (battery / OS suspension) and foregrounding
 *    reopens it - immediately, with the backoff reset, even for an 'active' that no 'background' preceded
 *    (screen lock / Control Center / a call, where the OS still drops the TCP connection) - via the core's
 *    suspend()/resume() and the pure policy in `wsAppState.ts`. The listener is installed lazily on the
 *    first connect intent (the core's `onConnectIntent` hook), as it always was.
 *  - the native behavior choices: a send while the socket is down is DROPPED (the shared useChat outbox
 *    owns the replay, so the core must not also queue), the LAST release() disconnects outright
 *    (`teardownPolicy: "eager"`), and an unresolvable transport RETRIES on the backoff schedule rather
 *    than going inert - `getToken()` can transiently return null on a signed build even when authed,
 *    because SecureStore is WHEN_UNLOCKED and a Keychain read while the device is briefly locked yields
 *    null. Opening a tokenless socket would be rejected 1008 and spin a tight
 *    connect->reject->reconnect loop, so the transport reports "unavailable" and the next attempt
 *    re-reads the token once the Keychain is readable.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native"
import { ChatSocketCore, type WsConnection } from "@civfix/ui/realtime"
import { applyAppStateTransition } from "@/lib/wsAppState"
import { openTicketedSocket } from "@/lib/wsTransport"
import { API_URL } from "@/config"
import { getToken } from "@/auth/storage"
import { api } from "@/api/client"

/**
 * RN's WebSocket accepts a 3rd `options` arg ({ headers }) at runtime to set handshake request headers,
 * but the ambient DOM `WebSocket` type (1-2 args) omits it. This is the runtime-correct ctor shape.
 */
type RNWebSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket

/** The current bearer, or null if unreadable (a locked Keychain / signed out). Never throws. */
async function readToken(): Promise<string | null> {
  try {
    return await getToken()
  } catch {
    return null
  }
}

/**
 * Resolve auth + URL and construct the native socket. Returns null when there is no readable bearer or
 * no connect ticket, so the core backs off and retries instead of opening a handshake the server rejects.
 */
function openNativeSocket(): Promise<WsConnection | null> {
  return openTicketedSocket({
    apiUrl: API_URL,
    readToken,
    mintTicket: async () => (await api.wsTicket()).ticket ?? null,
    connect: (url) =>
      new (WebSocket as unknown as RNWebSocketCtor)(url, undefined, { headers: { Origin: "" } }),
  })
}

/**
 * Installed once, on the first connect intent: close on background, reopen + re-join on foreground.
 * The policy itself (including the immediate reconnect + backoff reset when the app foregrounds from an
 * INACTIVE period that never backgrounded it - screen lock, Control Center, an incoming call - which the
 * core's `resume()` alone would skip) is the pure `applyAppStateTransition`; see src/lib/wsAppState.ts.
 */
let appStateSub: NativeEventSubscription | null = null
function ensureAppStateListener(): void {
  if (appStateSub) return
  appStateSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    applyAppStateTransition(next, chatSocket)
  })
}

/** The single shared chat socket used by every open conversation and the always-on realtime channel. */
export const chatSocket = new ChatSocketCore({
  transport: { open: openNativeSocket, authKey: readToken },
  // A transiently unreadable Keychain must recover on its own rather than leaving the socket dead.
  retryWhenUnavailable: true,
  // The shared useChat outbox replays failed sends on reconnect; a second queue here would double-send.
  queueWhileClosed: false,
  // The last chat screen / channel holder to let go tears the socket down (no dangling authed socket).
  teardownPolicy: "eager",
  // Historically the mobile socket started in an extra "idle" state that the UI rendered as connecting.
  initialStatus: "connecting",
  // ...and reported "closed" (offline) between reconnect attempts rather than "connecting".
  statusWhileBackingOff: "closed",
  onConnectIntent: ensureAppStateListener,
  onInvalidFrame: (direction, issues) => {
    if (__DEV__) console.warn(`[ws] dropping invalid ${direction} frame`, issues)
  },
})
