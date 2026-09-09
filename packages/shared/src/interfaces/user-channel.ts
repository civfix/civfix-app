import type { ChatConnection } from "./chat-service.js"
import type { UserSignal } from "../types/ws.js"

/**
 * Per-user realtime signal fan-out behind a vendor-neutral interface.
 *
 * This is a NEW seam rather than an extension of `ChatService`: per-user invalidate events are a
 * distinct concern from chat ROOMS (interface-segregation - a consumer wanting "tell this user to
 * refetch" should not depend on join/persist/history). A connection is addressed by `userId` and stays
 * "always joined" for the socket's whole lifetime, so there is no room key and no per-message leaveRoom;
 * `subscribeUser` instead returns an async unsubscribe handle, matching pub/sub ergonomics and letting
 * the gateway hold exactly one disposer per socket. The delivery model is signal/invalidate: a frame
 * carries only a topic + optional scoping id, never entity data - the client refetches authoritative
 * state once it learns a domain is stale.
 */
export interface UserChannel {
  /** Register conn (held by userId) to receive this user's signal frames on THIS worker. Returns an
   *  async unsubscribe handle. Idempotent per connection. Addressed by userId (not roomId): the user is
   *  "always joined" for the socket's whole lifetime. */
  subscribeUser(userId: string, conn: ChatConnection): Promise<() => Promise<void>>
  /** Publish a signal to every live connection userId holds, across all workers. Best-effort. */
  publishToUser(userId: string, signal: UserSignal): Promise<void>
  /** Fan a signal to many users (e.g. all cleanup members on a new message). Best-effort. */
  publishToUsers(userIds: readonly string[], signal: UserSignal): Promise<void>
  /** Tear down owned resources (per-user subscriptions). Safe to call once at shutdown. */
  close(): Promise<void>
}
