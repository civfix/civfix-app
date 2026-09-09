/**
 * The pending read-watermark `useChat` debounces, plus the pure rule deciding whether a queued watermark
 * may still be flushed - extracted here (like ./inbound.ts and ./aroundWindow.ts) so the rule is unit
 * testable without a React renderer.
 *
 * WHY THE ROOM TRAVELS WITH THE WATERMARK: the socket lifecycle effect flushes the pending ack in its
 * CLEANUP, before it leaves the room. `roomId` is a changeable PROP, so that cleanup also runs when the
 * caller switches rooms on the SAME hook instance - and React commits the next render's LAYOUT effects
 * before it runs the previous render's PASSIVE cleanups, so anything the cleanup reads through a
 * render-synced ref already points at the NEW room. A bare `upToId` therefore gives the flush no way to
 * tell which room the id belongs to, and the ack lands in the wrong room: room A's watermark is never
 * acked (its unread badge stays lit) while room B is told the user read a message that isn't even in it.
 *
 * Tagging the watermark with the room it was queued for lets the cleanup flush ONLY its own room's
 * watermark - the id and the room it is sent to always come from the same place.
 */
import type { RoomKind } from "@civfix/shared"

/** A debounced read watermark, tagged with the room whose message ids it is expressed in. */
export interface PendingReadAck {
  roomId: string
  roomKind: RoomKind
  upToId: string
}

/**
 * The watermark that the room `(roomId, roomKind)` may flush as it tears down: the pending message id
 * when it was queued FOR THAT ROOM, else null - nothing is pending, or what is pending belongs to a room
 * this teardown does not own (so sending it here would corrupt both rooms' read positions).
 */
export function readAckToFlush(
  pending: PendingReadAck | null,
  roomId: string,
  roomKind: RoomKind,
): string | null {
  if (!pending) return null
  if (pending.roomId !== roomId || pending.roomKind !== roomKind) return null
  return pending.upToId
}
