/**
 * @civfix/ui/realtime: the shared chat/signals WebSocket core (desired rooms, rejected rooms, frame
 * validation, send queue, backoff, refcounting, auto-rejoin). Each host supplies a `WsTransport` (URL,
 * handshake auth, socket construction) and the few `ChatSocketCoreOptions` where the two apps behave
 * differently, then passes the configured instance into the shared data context as its `ChatSocketLike`.
 */
export { ChatSocketCore } from "./chatSocketCore"
export type { WsTransport, WsConnection, ChatSocketCoreOptions } from "./types"
