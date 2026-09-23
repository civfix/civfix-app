import { describe, it, expect } from "vitest"
import type { ChatMessageDTO, PersonDTO, OutboxEntry } from "@civfix/shared"
import { mergeChatItems, isMine, effectiveClientId, reconcileInbound } from "@civfix/shared"

/**
 * The primitives are tested fully in @civfix/shared; this pins the contract this app depends on, driven
 * the way useChat drives them. The WS `ack` frame carries the canonical clientId at the frame's top
 * level while `message` may omit it, and reconciling with that id must leave exactly one non-pending row.
 */

const ME = "user-me"
const OTHER = "user-other"

function person(id: string, name = id): PersonDTO {
  return { id, name, followers: 0, following: 0, isFollowing: false }
}

function msg(
  partial: Partial<ChatMessageDTO> & { id: string; createdAt: string; fromId?: string },
): ChatMessageDTO {
  const { fromId, ...rest } = partial
  return {
    cleanupId: "c1",
    from: person(fromId ?? OTHER),
    body: rest.id,
    kind: "text",
    ...rest,
  } as ChatMessageDTO
}

function outbox(clientId: string, createdAt: string, status: OutboxEntry["status"]): OutboxEntry {
  return {
    clientId,
    status,
    message: msg({ id: clientId, createdAt, fromId: "me", clientId }),
  }
}

/**
 * Mirror useChat's reconcile step: it folds one inbound frame into the (outbox, liveMessages) pair via
 * two independent state updaters, each derived from `reconcileInbound`. Keeping the helper here means
 * the test drives the shared API through the exact shape the hook uses.
 */
function applyInbound(
  outbox: OutboxEntry[],
  liveMessages: ChatMessageDTO[],
  message: ChatMessageDTO,
  explicitClientId?: string,
): { outbox: OutboxEntry[]; liveMessages: ChatMessageDTO[] } {
  return {
    outbox: reconcileInbound(outbox, [], message, explicitClientId).outbox,
    liveMessages: reconcileInbound([], liveMessages, message, explicitClientId).liveMessages,
  }
}

describe("shared chat helpers (web usage contract)", () => {
  it("renders confirmed + outbox rows sorted chronologically, marking mine", () => {
    const a = msg({ id: "a", createdAt: "2026-01-01T00:00:02.000Z", fromId: ME })
    const b = msg({ id: "b", createdAt: "2026-01-01T00:00:01.000Z", fromId: OTHER })
    const pending = outbox("cid-1", "2026-01-01T00:00:03.000Z", "sending")
    const items = mergeChatItems([a], [b], [pending], ME)
    expect(items.map((i) => i.message.id)).toEqual(["b", "a", "cid-1"])
    expect(items.find((i) => i.message.id === "a")?.mine).toBe(true)
    expect(items.find((i) => i.message.id === "b")?.mine).toBe(false)
    expect(items.find((i) => i.message.clientId === "cid-1")?.pending).toBe(true)
  })

  it("isMine falls back to the 'me' sentinel before the viewer id is known", () => {
    expect(isMine(msg({ id: "m", createdAt: "t", fromId: "me" }), null)).toBe(true)
    expect(isMine(msg({ id: "m", createdAt: "t", fromId: OTHER }), null)).toBe(false)
  })

  it("effectiveClientId prefers the ack frame's top-level id over message.clientId", () => {
    const m = msg({ id: "s1", createdAt: "t", clientId: "from-message" })
    expect(effectiveClientId(m, "from-ack")).toBe("from-ack")
    expect(effectiveClientId(msg({ id: "s2", createdAt: "t", clientId: "only-message" }))).toBe(
      "only-message",
    )
    expect(effectiveClientId(msg({ id: "s3", createdAt: "t" }))).toBeUndefined()
  })

  it("ACK with a TOP-LEVEL clientId (message omits it) clears the bubble and yields no duplicate", () => {
    // The real-backend ack contract: { type:"ack", clientId, message } where message has NO clientId.
    const pending = outbox("cid-1", "2026-01-01T00:00:05.000Z", "sending")
    const ackMessage = msg({ id: "server-1", createdAt: "2026-01-01T00:00:05.000Z", fromId: "me" })
    expect(ackMessage.clientId).toBeUndefined()

    // useChat clears the send timer off the SAME effective id it reconciles with.
    expect(effectiveClientId(ackMessage, "cid-1")).toBe("cid-1")

    const next = applyInbound([pending], [], ackMessage, "cid-1")
    // The optimistic bubble is matched and removed, and the stored copy is stamped with the clientId.
    expect(next.outbox).toHaveLength(0)
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.clientId).toBe("cid-1")
    expect(next.liveMessages[0]?.id).toBe("server-1")

    // End-to-end: merging the reconciled state shows exactly one, non-pending row (no duplicate).
    const items = mergeChatItems([], next.liveMessages, next.outbox, ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.id).toBe("server-1")
    expect(items[0]?.pending).toBe(false)
  })

  it("de-dupes a message that arrives live and later via a history page (last writer wins)", () => {
    const live = msg({ id: "dup", createdAt: "2026-01-01T00:00:01.000Z", body: "new" })
    const history = msg({ id: "dup", createdAt: "2026-01-01T00:00:01.000Z", body: "old" })
    const items = mergeChatItems([history], [live], [], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.body).toBe("new")
  })

  it("keeps a still-unacked outbox bubble, flagged failed once the send times out", () => {
    const failed = outbox("cid-x", "2026-01-01T00:00:01.000Z", "failed")
    const items = mergeChatItems([], [], [failed], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.failed).toBe(true)
    expect(items[0]?.mine).toBe(true)
  })
})
