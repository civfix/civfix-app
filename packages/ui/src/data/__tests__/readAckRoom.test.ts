/**
 * `useChat` flushes the debounced read watermark in the socket effect's cleanup, and on an in-place room
 * switch (BodyRouter renders ConversationBody unkeyed) React commits the next render's LAYOUT effects
 * before the previous render's PASSIVE cleanups, so a render-synced ref already points at room B while the
 * watermark is still room A's. The watermark therefore carries the room it was queued for, and
 * `readAckToFlush` releases it only to that room's teardown; otherwise A's badge stays lit and B is told
 * the viewer read a message that is not in it.
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
