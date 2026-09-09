/**
 * Unit test for the `message_update` WS frame handling in `useChat` (chat P0, Task 0.4).
 *
 * The hook feeds `frame.message` from a `message_update` frame into the SAME 50ms
 * buffered reconcile as `message` frames: `flushInbound` applies the batch through
 * `foldInboundBatch` (data/inbound.ts) — the hook's ACTUAL fold, imported here rather
 * than replicated — then `mergeChatItems` merges history + live + outbox with
 * last-writer-wins by id. The hook itself needs a React renderer (this package tests
 * pure logic only), so this suite drives the fold at the function level and asserts
 * the refreshed DTO REPLACES the stale copy rather than duplicating it.
 */
import { describe, expect, it } from "vitest"
import { mergeChatItems, type ChatMessageDTO, type OutboxEntry, type PersonDTO } from "@civfix/shared"
import { foldInboundBatch } from "../inbound"

const ROOM = "room-1"
const ME = "user-me"
const OTHER = "user-other"

function person(id: string): PersonDTO {
  return { id, name: id, followers: 0, following: 0, isFollowing: false } as PersonDTO
}

function msg(
  partial: Partial<ChatMessageDTO> & { id: string; createdAt: string; fromId?: string },
): ChatMessageDTO {
  const { fromId, ...rest } = partial
  return {
    cleanupId: ROOM,
    from: person(fromId ?? OTHER),
    body: rest.id,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    ...rest,
  } as ChatMessageDTO
}

/** Wrap DTOs the way the hook buffers them (message_update frames carry no explicitClientId). */
function batch(...messages: ChatMessageDTO[]) {
  return messages.map((message) => ({ message }))
}

describe("message_update frame reconcile", () => {
  it("replaces a live message in place when the edited DTO arrives", () => {
    const original = msg({ id: "m1", createdAt: "2026-07-18T10:00:00.000Z", body: "helo" })
    const edited = msg({
      id: "m1",
      createdAt: "2026-07-18T10:00:00.000Z",
      body: "hello",
      editedAt: "2026-07-18T10:05:00.000Z",
    })
    const next = foldInboundBatch([], [original], batch(edited))

    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.body).toBe("hello")
    expect(next.liveMessages[0]?.editedAt).toBe("2026-07-18T10:05:00.000Z")

    const items = mergeChatItems([], next.liveMessages, [], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.body).toBe("hello")
  })

  it("supersedes a history copy in the merged list (last writer wins by id)", () => {
    const history = [
      msg({ id: "m1", createdAt: "2026-07-18T10:00:00.000Z", body: "helo" }),
      msg({ id: "m2", createdAt: "2026-07-18T10:01:00.000Z", body: "other" }),
    ]
    const edited = msg({
      id: "m1",
      createdAt: "2026-07-18T10:00:00.000Z",
      body: "hello",
      editedAt: "2026-07-18T10:05:00.000Z",
    })
    const { liveMessages } = foldInboundBatch([], [], batch(edited))

    const items = mergeChatItems(history, liveMessages, [], ME)
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.message.id)).toEqual(["m1", "m2"])
    expect(items[0]?.message.body).toBe("hello")
    expect(items[0]?.message.editedAt).toBe("2026-07-18T10:05:00.000Z")
  })

  it("replaces the live original with a tombstoned DTO (deletedAt set, empty body)", () => {
    const original = msg({ id: "m1", createdAt: "2026-07-18T10:00:00.000Z", body: "regret" })
    const tombstone = msg({
      id: "m1",
      createdAt: "2026-07-18T10:00:00.000Z",
      body: "",
      deletedAt: "2026-07-18T10:07:00.000Z",
    })
    const next = foldInboundBatch([], [original], batch(tombstone))

    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.body).toBe("")
    expect(next.liveMessages[0]?.deletedAt).toBe("2026-07-18T10:07:00.000Z")

    const items = mergeChatItems([], next.liveMessages, [], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.deletedAt).toBe("2026-07-18T10:07:00.000Z")
    expect(items[0]?.message.body).toBe("")
  })

  it("does not disturb an unrelated pending outbox entry", () => {
    const pending: OutboxEntry = {
      clientId: "c1",
      status: "sending",
      message: msg({
        id: "c1",
        createdAt: "2026-07-18T10:06:00.000Z",
        fromId: ME,
        body: "draft",
        clientId: "c1",
      }),
    }
    const edited = msg({
      id: "m1",
      createdAt: "2026-07-18T10:00:00.000Z",
      body: "hello",
      editedAt: "2026-07-18T10:05:00.000Z",
    })
    const next = foldInboundBatch([pending], [], batch(edited))

    expect(next.outbox).toHaveLength(1)
    const items = mergeChatItems([], next.liveMessages, next.outbox, ME)
    expect(items).toHaveLength(2)
    expect(items[0]?.message.body).toBe("hello")
    expect(items[1]?.pending).toBe(true)
  })
})
