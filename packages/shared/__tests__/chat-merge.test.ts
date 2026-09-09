import { describe, it, expect } from "vitest"
import type { ChatMessageDTO, PersonDTO } from "../src/schemas/entities.js"
import {
  mergeChatItems,
  isMine,
  effectiveClientId,
  preserveViewerFields,
  reconcileInbound,
  reconciledByContent,
  OUTBOX_MATCH_WINDOW_MS,
  type OutboxEntry,
} from "../src/chat/merge.js"


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


describe("isMine", () => {
  it("matches by user id", () => {
    expect(isMine(msg({ id: "m1", createdAt: "t", fromId: ME }), ME)).toBe(true)
    expect(isMine(msg({ id: "m1", createdAt: "t", fromId: OTHER }), ME)).toBe(false)
  })

  it("falls back to the 'me' sentinel when the viewer id is unknown", () => {
    expect(isMine(msg({ id: "m1", createdAt: "t", fromId: "me" }), null)).toBe(true)
    expect(isMine(msg({ id: "m1", createdAt: "t", fromId: OTHER }), null)).toBe(false)
  })
})

describe("mergeChatItems", () => {
  it("sorts confirmed messages chronologically by createdAt", () => {
    const a = msg({ id: "a", createdAt: "2026-01-01T00:00:02.000Z" })
    const b = msg({ id: "b", createdAt: "2026-01-01T00:00:01.000Z" })
    const c = msg({ id: "c", createdAt: "2026-01-01T00:00:03.000Z" })
    const items = mergeChatItems([a, c], [b], [], ME)
    expect(items.map((i) => i.message.id)).toEqual(["b", "a", "c"])
  })

  it("de-dupes by message id across history and live (last writer wins)", () => {
    const historyCopy = msg({ id: "dup", createdAt: "2026-01-01T00:00:01.000Z", body: "old" })
    const liveCopy = msg({ id: "dup", createdAt: "2026-01-01T00:00:01.000Z", body: "new" })
    const items = mergeChatItems([historyCopy], [liveCopy], [], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.body).toBe("new")
  })

  it("drops the optimistic outbox bubble once its server echo (same clientId) is seen", () => {
    const serverEcho = msg({
      id: "server-1",
      createdAt: "2026-01-01T00:00:05.000Z",
      fromId: "me",
      clientId: "cid-1",
    })
    const pendingSameCid = outbox("cid-1", "2026-01-01T00:00:05.000Z", "sending")
    const items = mergeChatItems([], [serverEcho], [pendingSameCid], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.id).toBe("server-1")
    expect(items[0]?.pending).toBe(false)
  })

  it("keeps an outbox bubble whose echo has NOT arrived, flagged pending or failed", () => {
    const sending = outbox("cid-sending", "2026-01-01T00:00:01.000Z", "sending")
    const failed = outbox("cid-failed", "2026-01-01T00:00:02.000Z", "failed")
    const items = mergeChatItems([], [], [sending, failed], ME)
    expect(items).toHaveLength(2)
    const s = items.find((i) => i.message.clientId === "cid-sending")
    const f = items.find((i) => i.message.clientId === "cid-failed")
    expect(s?.pending).toBe(true)
    expect(s?.failed).toBe(false)
    expect(f?.pending).toBe(false)
    expect(f?.failed).toBe(true)
    expect(s?.mine).toBe(true)
    expect(f?.mine).toBe(true)
  })

  it("marks confirmed messages as mine based on author id", () => {
    const mine = msg({ id: "m1", createdAt: "2026-01-01T00:00:01.000Z", fromId: ME })
    const theirs = msg({ id: "m2", createdAt: "2026-01-01T00:00:02.000Z", fromId: OTHER })
    const items = mergeChatItems([mine, theirs], [], [], ME)
    expect(items.find((i) => i.message.id === "m1")?.mine).toBe(true)
    expect(items.find((i) => i.message.id === "m2")?.mine).toBe(false)
  })

  it("breaks createdAt ties deterministically by id", () => {
    const t = "2026-01-01T00:00:01.000Z"
    const z = msg({ id: "z", createdAt: t })
    const a = msg({ id: "a", createdAt: t })
    const items = mergeChatItems([z, a], [], [], ME)
    expect(items.map((i) => i.message.id)).toEqual(["a", "z"])
  })

  it("returns an empty list when there is nothing to merge", () => {
    expect(mergeChatItems([], [], [], ME)).toEqual([])
  })
})

describe("effectiveClientId", () => {
  it("prefers the explicit (ack frame top-level) clientId over the message field", () => {
    const m = msg({ id: "s1", createdAt: "t", clientId: "from-message" })
    expect(effectiveClientId(m, "from-ack")).toBe("from-ack")
  })

  it("falls back to the message clientId when no explicit id is given", () => {
    const m = msg({ id: "s1", createdAt: "t", clientId: "from-message" })
    expect(effectiveClientId(m)).toBe("from-message")
  })

  it("is undefined when neither is present", () => {
    const m = msg({ id: "s1", createdAt: "t" })
    expect(effectiveClientId(m)).toBeUndefined()
  })
})

describe("reconcileInbound", () => {
  it("clears the optimistic outbox entry using the ack frame's TOP-LEVEL clientId (message omits it)", () => {
    const pending = outbox("cid-1", "2026-01-01T00:00:01.000Z", "sending")
    const ackMessage = msg({ id: "server-1", createdAt: "2026-01-01T00:00:01.000Z", fromId: "me" })
    expect(ackMessage.clientId).toBeUndefined()

    const next = reconcileInbound([pending], [], ackMessage, "cid-1")

    expect(next.outbox).toHaveLength(0)
    expect(next.matchedClientId).toBe("cid-1")
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.clientId).toBe("cid-1")
    expect(next.liveMessages[0]?.id).toBe("server-1")

    const merged = mergeChatItems([], next.liveMessages, next.outbox, ME)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.message.id).toBe("server-1")
    expect(merged[0]?.pending).toBe(false)
  })

  it("matches on message.clientId when the frame carries no explicit id (fake/message path)", () => {
    const pending = outbox("cid-2", "2026-01-01T00:00:02.000Z", "sending")
    const echoed = msg({
      id: "server-2",
      createdAt: "2026-01-01T00:00:02.000Z",
      fromId: "me",
      clientId: "cid-2",
    })
    const next = reconcileInbound([pending], [], echoed)
    expect(next.outbox).toHaveLength(0)
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.id).toBe("server-2")
  })

  it("de-dupes an already-stored live message by id instead of appending a duplicate", () => {
    const first = msg({ id: "dup", createdAt: "2026-01-01T00:00:03.000Z", body: "old" })
    const second = msg({ id: "dup", createdAt: "2026-01-01T00:00:03.000Z", body: "new" })
    const next = reconcileInbound([], [first], second)
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.body).toBe("new")
  })

  it("updates the existing live copy in place when a later ack arrives for the same clientId", () => {
    const live = msg({
      id: "tmp",
      createdAt: "2026-01-01T00:00:04.000Z",
      fromId: "me",
      clientId: "cid-3",
    })
    const ackMessage = msg({ id: "server-3", createdAt: "2026-01-01T00:00:04.000Z", fromId: "me" })
    const next = reconcileInbound([], [live], ackMessage, "cid-3")
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.id).toBe("server-3")
    expect(next.liveMessages[0]?.clientId).toBe("cid-3")
  })

  it("appends a foreign message (no clientId) without touching the outbox", () => {
    const pending = outbox("cid-mine", "2026-01-01T00:00:05.000Z", "sending")
    const foreign = msg({ id: "other-1", createdAt: "2026-01-01T00:00:06.000Z", fromId: OTHER })
    const next = reconcileInbound([pending], [], foreign)
    expect(next.outbox).toHaveLength(1)
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.id).toBe("other-1")
    expect(next.matchedClientId).toBeUndefined()
  })

  it("a viewer-truth ack landing AFTER its neutral broadcast echo applies wholesale (mine + reactions + ballot win)", () => {
    const neutralEcho = msg({
      id: "server-9",
      createdAt: "2026-01-01T00:00:09.000Z",
      fromId: "me",
      reactions: [{ emoji: "❤️", count: 1, mine: false }],
    })
    const afterEcho = reconcileInbound([], [], neutralEcho)
    expect(afterEcho.liveMessages).toHaveLength(1)

    const ackMessage = msg({
      id: "server-9",
      createdAt: "2026-01-01T00:00:09.000Z",
      fromId: "me",
      mine: true,
      reactions: [{ emoji: "❤️", count: 1, mine: true }],
    })
    const next = reconcileInbound([], afterEcho.liveMessages, ackMessage, "cid-9", true)

    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.mine).toBe(true)
    expect(next.liveMessages[0]?.reactions?.[0]?.mine).toBe(true)
    expect(next.liveMessages[0]?.clientId).toBe("cid-9")
  })

  it("without the viewer-truth flag the same ack is (deliberately) preserved AGAINST the local copy", () => {
    const neutralEcho = msg({
      id: "server-10",
      createdAt: "2026-01-01T00:00:10.000Z",
      fromId: "me",
      reactions: [{ emoji: "❤️", count: 1, mine: false }],
    })
    const ackMessage = msg({
      id: "server-10",
      createdAt: "2026-01-01T00:00:10.000Z",
      fromId: "me",
      mine: true,
      reactions: [{ emoji: "❤️", count: 1, mine: true }],
    })
    const next = reconcileInbound([], [neutralEcho], ackMessage, "cid-10")
    expect(next.liveMessages[0]?.mine).toBeUndefined()
    expect(next.liveMessages[0]?.reactions?.[0]?.mine).toBe(false)
  })
})


describe("reconciledByContent", () => {
  it("matches an outbox entry to a confirmed-mine twin by body within the window", () => {
    const entry = outbox("cid-a", "2026-01-01T00:00:00.000Z", "sending")
    entry.message = msg({ id: "cid-a", createdAt: "2026-01-01T00:00:00.000Z", fromId: "me", body: "hello" })
    const confirmed = msg({
      id: "server-a",
      createdAt: "2026-01-01T00:00:10.000Z",
      fromId: ME,
      body: "hello",
    })
    const matched = reconciledByContent([entry], [confirmed])
    expect([...matched]).toEqual(["cid-a"])
  })

  it("does NOT match when bodies differ", () => {
    const entry = outbox("cid-b", "2026-01-01T00:00:00.000Z", "sending")
    entry.message = msg({ id: "cid-b", createdAt: "2026-01-01T00:00:00.000Z", fromId: "me", body: "one" })
    const confirmed = msg({ id: "server-b", createdAt: "2026-01-01T00:00:05.000Z", fromId: ME, body: "two" })
    expect(reconciledByContent([entry], [confirmed]).size).toBe(0)
  })

  it("does NOT match outside the time window", () => {
    const entry = outbox("cid-c", "2026-01-01T00:00:00.000Z", "sending")
    entry.message = msg({ id: "cid-c", createdAt: "2026-01-01T00:00:00.000Z", fromId: "me", body: "x" })
    const confirmed = msg({
      id: "server-c",
      createdAt: new Date(Date.parse("2026-01-01T00:00:00.000Z") + OUTBOX_MATCH_WINDOW_MS + 1).toISOString(),
      fromId: ME,
      body: "x",
    })
    expect(reconciledByContent([entry], [confirmed]).size).toBe(0)
  })

  it("consumes each confirmed message at most once (two identical sends do not both collapse)", () => {
    const e1 = outbox("cid-1", "2026-01-01T00:00:00.000Z", "sending")
    e1.message = msg({ id: "cid-1", createdAt: "2026-01-01T00:00:00.000Z", fromId: "me", body: "dup" })
    const e2 = outbox("cid-2", "2026-01-01T00:00:01.000Z", "sending")
    e2.message = msg({ id: "cid-2", createdAt: "2026-01-01T00:00:01.000Z", fromId: "me", body: "dup" })
    const confirmed = msg({ id: "server-1", createdAt: "2026-01-01T00:00:02.000Z", fromId: ME, body: "dup" })
    const matched = reconciledByContent([e1, e2], [confirmed])
    expect(matched.size).toBe(1)
  })
})

describe("mergeChatItems content-reconcile (echo dropped clientId)", () => {
  it("suppresses the optimistic bubble when a confirmed-mine message matches by content", () => {
    const pending = outbox("cid-z", "2026-01-01T00:00:00.000Z", "sending")
    pending.message = msg({ id: "cid-z", createdAt: "2026-01-01T00:00:00.000Z", fromId: "me", body: "hi there" })
    const echo = msg({
      id: "server-z",
      createdAt: "2026-01-01T00:00:03.000Z",
      fromId: ME,
      body: "hi there",
    })
    const items = mergeChatItems([], [echo], [pending], ME)
    expect(items).toHaveLength(1)
    expect(items[0]?.message.id).toBe("server-z")
    expect(items[0]?.pending).toBe(false)
  })

  it("keeps the bubble when the confirmed message is from someone else (not a content twin)", () => {
    const pending = outbox("cid-y", "2026-01-01T00:00:00.000Z", "sending")
    pending.message = msg({
      id: "cid-y",
      createdAt: "2026-01-01T00:00:00.000Z",
      fromId: "me",
      body: "same words",
      clientId: "cid-y",
    })
    const otherSaysSame = msg({
      id: "server-y",
      createdAt: "2026-01-01T00:00:03.000Z",
      fromId: OTHER,
      body: "same words",
    })
    const items = mergeChatItems([], [otherSaysSame], [pending], ME)
    expect(items).toHaveLength(2)
    const bubble = items.find((i) => i.message.id === "cid-y")
    expect(bubble?.pending).toBe(true)
    expect(bubble?.mine).toBe(true)
  })
})

describe("mergeChatItems sort stability", () => {
  it("orders rows with an unparsable createdAt deterministically instead of returning NaN", () => {
    const broken = msg({ id: "b", createdAt: "not-a-date", fromId: OTHER })
    const alsoBroken = msg({ id: "a", createdAt: "", fromId: OTHER })
    const real = msg({ id: "c", createdAt: "2026-01-01T00:00:05.000Z", fromId: OTHER })

    const forwards = mergeChatItems([broken, alsoBroken, real], [], [], ME).map((i) => i.message.id)
    const backwards = mergeChatItems([real, alsoBroken, broken], [], [], ME).map((i) => i.message.id)

    expect(forwards).toEqual(["a", "b", "c"])
    expect(backwards).toEqual(forwards)
  })
})

describe("preserveViewerFields", () => {
  const poll = (myVote: number[], mines: boolean[], counts: number[], closed = false) => ({
    question: "q",
    options: mines.map((mine, idx) => ({ idx, text: `opt-${idx}`, count: counts[idx] ?? 0, mine })),
    allowMultiple: false,
    anonymous: false,
    closed,
    totalVoters: counts.reduce((a, b) => a + b, 0),
    myVote,
  })

  it("keeps the local myVote and options[].mine when a neutral room-wide poll DTO arrives", () => {
    const local = msg({ id: "p1", createdAt: "t", poll: poll([1], [false, true], [0, 1]) })
    const neutral = msg({ id: "p1", createdAt: "t", poll: poll([], [false, false], [2, 3]) })
    const merged = preserveViewerFields(local, neutral)
    expect(merged.poll?.myVote).toEqual([1])
    expect(merged.poll?.options.map((o) => o.mine)).toEqual([false, true])
    expect(merged.poll?.options.map((o) => o.count)).toEqual([2, 3])
    expect(merged.poll?.totalVoters).toBe(5)
  })

  it("matches poll options by idx, not array position", () => {
    const local = msg({ id: "p1", createdAt: "t", poll: poll([1], [false, true], [0, 1]) })
    const reordered = msg({ id: "p1", createdAt: "t" })
    reordered.poll = {
      ...poll([], [false, false], [0, 0]),
      options: [
        { idx: 1, text: "opt-1", count: 4, mine: false },
        { idx: 0, text: "opt-0", count: 2, mine: false },
      ],
    }
    const merged = preserveViewerFields(local, reordered)
    expect(merged.poll?.options.map((o) => [o.idx, o.mine, o.count])).toEqual([
      [1, true, 4],
      [0, false, 2],
    ])
  })

  it("does not clear myVote when the viewer's copy has voted and a foreign actor's DTO arrives", () => {
    const local = msg({ id: "p1", createdAt: "t", poll: poll([0], [true, false], [1, 0]) })
    const actors = msg({ id: "p1", createdAt: "t", poll: poll([1], [false, true], [1, 1]) })
    const merged = preserveViewerFields(local, actors)
    expect(merged.poll?.myVote).toEqual([0])
    expect(merged.poll?.options.map((o) => o.mine)).toEqual([true, false])
    expect(merged.poll?.options.map((o) => o.count)).toEqual([1, 1])
  })

  it("keeps the viewer's own reaction `mine` flags and neutralizes foreign ones", () => {
    const local = msg({
      id: "m1",
      createdAt: "t",
      reactions: [{ emoji: "❤️", count: 1, mine: true }],
    })
    const foreign = msg({
      id: "m1",
      createdAt: "t",
      reactions: [
        { emoji: "❤️", count: 2, mine: false },
        { emoji: "👍", count: 1, mine: true },
      ],
    })
    const merged = preserveViewerFields(local, foreign)
    expect(merged.reactions).toEqual([
      { emoji: "❤️", count: 2, mine: true },
      { emoji: "👍", count: 1, mine: false },
    ])
  })

  it("takes shared fields (body, editedAt, closed) from the inbound DTO", () => {
    const local = msg({ id: "p1", createdAt: "t", body: "old", poll: poll([0], [true], [1]) })
    const inbound = msg({
      id: "p1",
      createdAt: "t",
      body: "new",
      editedAt: "2026-01-01T00:00:09.000Z",
      poll: poll([], [false], [3], true),
    })
    const merged = preserveViewerFields(local, inbound)
    expect(merged.body).toBe("new")
    expect(merged.editedAt).toBe("2026-01-01T00:00:09.000Z")
    expect(merged.poll?.closed).toBe(true)
    expect(merged.poll?.myVote).toEqual([0])
  })

  it("preserves the local top-level mine and never adopts a foreign one", () => {
    const localMine = msg({ id: "m1", createdAt: "t", mine: true })
    const foreign = msg({ id: "m1", createdAt: "t", mine: false })
    expect(preserveViewerFields(localMine, foreign).mine).toBe(true)
    const localAbsent = msg({ id: "m1", createdAt: "t" })
    const actorsMine = msg({ id: "m1", createdAt: "t", mine: true })
    expect(preserveViewerFields(localAbsent, actorsMine).mine).toBeUndefined()
  })

  it("returns the inbound reference unchanged when there is nothing to preserve", () => {
    const local = msg({ id: "m1", createdAt: "t", body: "old", reactions: [] })
    const inbound = msg({ id: "m1", createdAt: "t", body: "new", reactions: [] })
    expect(preserveViewerFields(local, inbound)).toBe(inbound)
  })

  it("adopts a tombstone / removed poll wholesale", () => {
    const local = msg({ id: "p1", createdAt: "t", poll: poll([0], [true], [1]) })
    const tombstone = msg({ id: "p1", createdAt: "t", body: "", deletedAt: "2026-01-01T00:00:10.000Z" })
    const merged = preserveViewerFields(local, tombstone)
    expect(merged.deletedAt).toBe("2026-01-01T00:00:10.000Z")
    expect(merged.poll).toBeUndefined()
  })
})

describe("reconcileInbound viewer-field preservation", () => {
  it("a room-wide neutral poll frame replacing a live copy keeps the viewer's ballot", () => {
    const live = msg({ id: "p1", createdAt: "t", fromId: OTHER })
    live.poll = {
      question: "q",
      options: [
        { idx: 0, text: "a", count: 1, mine: true },
        { idx: 1, text: "b", count: 0, mine: false },
      ],
      allowMultiple: false,
      anonymous: false,
      closed: false,
      totalVoters: 1,
      myVote: [0],
    }
    const neutral = msg({ id: "p1", createdAt: "t", fromId: OTHER })
    neutral.poll = {
      question: "q",
      options: [
        { idx: 0, text: "a", count: 2, mine: false },
        { idx: 1, text: "b", count: 1, mine: false },
      ],
      allowMultiple: false,
      anonymous: false,
      closed: false,
      totalVoters: 3,
      myVote: [],
    }
    const next = reconcileInbound([], [live], neutral)
    expect(next.liveMessages).toHaveLength(1)
    expect(next.liveMessages[0]?.poll?.myVote).toEqual([0])
    expect(next.liveMessages[0]?.poll?.options.map((o) => o.mine)).toEqual([true, false])
    expect(next.liveMessages[0]?.poll?.options.map((o) => o.count)).toEqual([2, 1])
    expect(next.liveMessages[0]?.poll?.totalVoters).toBe(3)
  })

  it("an appended message (no local copy) is stored as sent", () => {
    const inbound = msg({ id: "m9", createdAt: "t", fromId: OTHER })
    const next = reconcileInbound([], [], inbound)
    expect(next.liveMessages[0]).toBe(inbound)
  })
})
