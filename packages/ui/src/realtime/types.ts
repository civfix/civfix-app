/**
 * The transport seam of the shared chat-socket core.
 *
 * Everything about the socket that is genuinely PLATFORM-specific lives behind this interface: how the
 * ws URL is derived, how the handshake is authenticated (web: a same-origin cookie handshake; mobile: a
 * single-use `?ticket=` / bearer `?token=` query param plus RN's empty-Origin header workaround), and how
 * the platform WebSocket is constructed. Everything else - desired rooms, rejected rooms, frame
 * validation, the send queue, backoff, refcounting, auto-rejoin - is host-neutral and lives in
 * `ChatSocketCore`.
 */
import type { ChatConnState } from "../data/types"

/** A live platform socket plus the auth identity it was opened under (see `WsTransport.authKey`). */
export interface WsConnection {
  /** The freshly constructed platform socket (CONNECTING). The core attaches its own handlers. */
  socket: WebSocket
  /**
   * The identity this socket's handshake authenticated as (mobile: the bearer). Compared against
   * `WsTransport.authKey()` on a later `connect()` so a sign-out -> different sign-in never keeps talking
   * on a socket authenticated as the previous user. Omit (web, cookie handshake) to skip the guard.
   */
  authKey?: string | null
}

/** The host-supplied transport the core drives. */
export interface WsTransport {
  /**
   * Resolve auth + URL and construct the platform socket. May be async (mobile mints a connect ticket).
   *
   * Return `null` for "cannot connect right now" - no window/WebSocket (web static export / SSR), or no
   * readable bearer yet (mobile: SecureStore is WHEN_UNLOCKED, so a read while the device is briefly
   * locked yields null and MUST NOT open an unauthenticated handshake). What happens next is the host's
   * policy, set by `retryWhenUnavailable`.
   *
   * Throwing is treated exactly like a failed attempt (backoff + retry).
   */
  open: () => WsConnection | null | Promise<WsConnection | null>
  /**
   * The CURRENT auth identity, for the socket-reuse guard. When a `connect()` finds a live socket, the
   * core compares this against the `authKey` the socket was opened with and recreates the socket if the
   * identity changed. Omit to disable the guard (web: the cookie handshake carries no client-side key).
   */
  authKey?: () => string | null | Promise<string | null>
}

/**
 * The host-selected behaviors where the two apps genuinely differ. Every one of these is a real,
 * pre-existing divergence between the web and mobile sockets, made explicit here instead of being
 * implicit in two 500-line copies.
 */
export interface ChatSocketCoreOptions {
  transport: WsTransport
  /** Initial reconnect backoff in ms (doubles per attempt, full jitter). Default 1000. */
  baseBackoffMs?: number
  /** Reconnect backoff ceiling in ms. Default 15000. */
  maxBackoffMs?: number
  /**
   * What to do when `transport.open()` yields null. `true` (mobile): back off and retry, so a transiently
   * unreadable Keychain recovers on its own. `false` (web, default): go closed and wait for the next
   * explicit connect()/retain() - a static export with no `window` must not spin a retry timer.
   */
  retryWhenUnavailable?: boolean
  /**
   * `true` (web, default false): frames sent while the socket is down are QUEUED in order and flushed on
   * the next open. `false` (mobile): a send while down is dropped and returns false - the chat outbox
   * owns the replay there.
   */
  queueWhileClosed?: boolean
  /**
   * Who may tear the socket down.
   *   - `"intent"` (web, default): `disconnect()` drops the always-on intent but leaves the socket up
   *     while a chat screen still holds it; `release()` tears down only when no intent remains. The web
   *     socket is shared with the always-on signals channel, so the two must not fight.
   *   - `"eager"` (mobile): `disconnect()` always tears down (and zeroes the refcount), and the LAST
   *     `release()` disconnects outright.
   */
  teardownPolicy?: "intent" | "eager"
  /** Status reported before the first connection attempt. Default "closed" (mobile reports "connecting"). */
  initialStatus?: ChatConnState
  /**
   * Status reported while a reconnect is scheduled. Default "connecting" (web shows a reconnecting
   * affordance); mobile has always reported "closed" between attempts.
   */
  statusWhileBackingOff?: ChatConnState
  /**
   * Called at the top of every connect intent (connect / retain / join / a queued send). The mobile host
   * installs its AppState listener here, preserving the "installed lazily on first use" behavior.
   */
  onConnectIntent?: () => void
  /** Dev-only warning sink for dropped frames. Omit to stay silent. */
  onInvalidFrame?: (direction: "inbound" | "outbound", issues: unknown) => void
}
