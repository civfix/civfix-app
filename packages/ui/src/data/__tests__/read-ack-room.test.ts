/**
 * Regression test for the ROOM-SWITCH read-ack leak in `useChat`.
 *
 * BUG. The socket lifecycle effect's cleanup flushes the debounced read watermark before it leaves the
 * room, and it used to flush through a ref that a `useLayoutEffect` re-pointed at the current
 * `sendReadAck`. `roomId` is a changeable PROP (BodyRouter renders ConversationBody unkeyed), and React
 * commits the next render's LAYOUT effects BEFORE running the previous render's PASSIVE cleanups - so on
 * an in-place room switch that ref already pointed at room B's closure while the pending watermark was
 * still room A's message id. The flush sent `{ upToId: <A's id>, cleanupId: B }`: A's unread badge stayed
 * lit (the exact bug the flush was added to fix) and B was told the viewer read a message not in it.
 *
 * FIX. The watermark carries the room it was queued for (`PendingReadAck`), and the cleanup builds the
 * frame from its OWN closed-over roomId/roomKind - flushing only a watermark that belongs to that room.
 * `readAckToFlush` is that decision, exercised here directly (this package tests pure logic only; the
 * hook itself needs a React renderer).
 */
import { describe, expect, it } from "vitest"
import { readAckToFlush, type PendingReadAck } from "../readAck"

const pending = (roomId: string, upToId: string, roomKind: PendingReadAck["roomKind"] = "cleanup") =>
  ({ roomId, roomKind, upToId }) satisfies PendingReadAck

describe("readAckToFlush", () => {
  it("flushes the watermark of the room tearing down", () => {
    expect(readAckToFlush(pending("room-a", "msg-9"), "room-a", "cleanup")).toBe("msg-9")
  })

  it("drops room A's watermark when the teardown belongs to another room", () => {
    // The room-switch leak: room A's queued id must never be acked into room B.
    expect(readAckToFlush(pending("room-a", "msg-9"), "room-b", "cleanup")).toBeNull()
  })

  it("drops a watermark from the same id in a DIFFERENT room kind", () => {
    // roomId alone is not the room: a report room and a group room can carry the same id, and the ack
    // frame is roomKind-stamped.
    expect(readAckToFlush(pending("r-1", "msg-9", "report"), "r-1", "group")).toBeNull()
    expect(readAckToFlush(pending("r-1", "msg-9", "report"), "r-1", "report")).toBe("msg-9")
  })

  it("flushes nothing when no watermark is pending", () => {
    // A pinned-only mount (suppressReadAcks) never seeds one, and neither does a room read to a
    // watermark that already acked.
    expect(readAckToFlush(null, "room-a", "cleanup")).toBeNull()
  })
})
