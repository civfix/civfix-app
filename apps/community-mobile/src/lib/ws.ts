/**
 * The handshake credential is a single-use `?ticket=` (see `wsTransport.ts`): the long-lived bearer never
 * goes in the URL, where it would land in server and proxy access logs.
 *
 * The Origin header is sent EMPTY on purpose. The backend's anti-CSWSH gate rejects an Origin outside
 * WEB_ORIGINS but allows a missing one on the cookie-less native path, and RN's WebSocket would otherwise
 * send the API's own origin, which is not allow-listed (close 1008).
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native"
import { ChatSocketCore, type WsConnection } from "@civfix/ui/realtime"
import { applyAppStateTransition } from "@/lib/wsAppState"
import { openTicketedSocket } from "@/lib/wsTransport"
import { API_URL } from "@/config"
import { getToken } from "@/auth/storage"
import { api } from "@/api/client"

// RN's WebSocket takes a third `{ headers }` argument at runtime that the DOM `WebSocket` type omits.
type RNWebSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket

async function readToken(): Promise<string | null> {
  try {
    return await getToken()
  } catch {
    return null
  }
}

function openNativeSocket(): Promise<WsConnection | null> {
  return openTicketedSocket({
    apiUrl: API_URL,
    readToken,
    mintTicket: async () => (await api.wsTicket()).ticket ?? null,
    connect: (url) =>
      new (WebSocket as unknown as RNWebSocketCtor)(url, undefined, { headers: { Origin: "" } }),
  })
}

let appStateSub: NativeEventSubscription | null = null
function ensureAppStateListener(): void {
  if (appStateSub) return
  appStateSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    applyAppStateTransition(next, chatSocket)
  })
}

export const chatSocket = new ChatSocketCore({
  transport: { open: openNativeSocket, authKey: readToken },
  // getToken() can transiently return null while the Keychain is unreadable; retry instead of going inert.
  retryWhenUnavailable: true,
  // The shared useChat outbox replays failed sends on reconnect; a second queue here would double-send.
  queueWhileClosed: false,
  // No authed socket is left open once the last chat screen or channel holder lets go.
  teardownPolicy: "eager",
  initialStatus: "connecting",
  statusWhileBackingOff: "closed",
  onConnectIntent: ensureAppStateListener,
  onInvalidFrame: (direction, issues) => {
    if (__DEV__) console.warn(`[ws] dropping invalid ${direction} frame`, issues)
  },
})
