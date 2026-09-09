/**
 * @civfix/ui/realtime — the shared chat/signals WebSocket core.
 *
 * Both community hosts used to carry their own ~500-line copy of this client (desired rooms, rejected
 * rooms, frame validation, send queue, backoff, refcounting, auto-rejoin), differing only in how the
 * handshake is authenticated. The core now lives here; each host supplies a `WsTransport` (URL + auth +
 * socket construction) and the few `ChatSocketCoreOptions` where the two apps genuinely behave
 * differently, then exports the configured instance straight into the shared data context as its
 * `ChatSocketLike`.
 */
export { ChatSocketCore } from "./chatSocketCore"
export type { WsTransport, WsConnection, ChatSocketCoreOptions } from "./types"
