import { describe, expect, it } from "vitest"
import {
  ErrorCode,
  mergeChatItems,
  type ChatHistoryResponse,
  type ChatMessageDTO,
  type OutboxEntry,
  type PersonDTO,
  type PollDTO,
} from "@civfix/shared"
import {
  foldHistoryIntoPages,
  foldInboundIntoPages,
  isFatalRoomErrorCode,
  isSendRejectionErrorCode,
  replayableEntries,
} from "../inbound"

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

function page(items: ChatMessageDTO[], nextCursor: string | null = null): ChatHistoryResponse {
  return { items, nextCursor }
}

function pollOf(myVote: number[], mines: boolean[], counts: number[]): PollDTO {
  return {
    question: "q",
    options: mines.map((mine, idx) => ({ idx, text: `opt-${idx}`, count: counts[idx] ?? 0, mine })),
    allowMultiple: false,
    anonymous: false,
    closed: false,
    totalVoters: counts.reduce((a, b) => a + b, 0),
    myVote,
  }
}

describe("foldInboundIntoPages", () => {
  it("appends a new live message to the newest page so it survives a remount from the cache", () => {
    const pages = [page([msg({ id: "m1", createdAt: "2026-01-01T00:00:01.000Z" })], "older")]
    const incoming = msg({ id: "m2", createdAt: "2026-01-01T00:00:02.000Z" })

    const next = foldInboundIntoPages(pages, [{ message: incoming }])

    expect(next).not.toBe(pages)
    expect(next[0]?.items.map((m) => m.id)).toEqual(["m1", "m2"])
    expect(next[0]?.nextCursor).toBe("older")

    const remounted = mergeChatItems(next.flatMap((p) => p.items), [], [], ME)
    expect(remounted.map((i) => i.message.id)).toEqual(["m1", "m2"])
  })

  it("stamps the ack frame's top-level clientId so the cached copy suppresses the optimistic bubble", () => {
    const pages = [page([])]
    const ackMessage = msg({ id: "server-1", createdAt: "2026-01-01T00:00:01.000Z", fromId: ME })
    const pendingEntry: OutboxEntry = {
      clientId: "cid-1",
      status: "sending",
      message: msg({ id: "cid-1", createdAt: "2026-01-01T00:00:01.000Z", fromId: "me", clientId: "cid-1" }),
    }

    const next = foldInboundIntoPages(pages, [{ message: ackMessage, explicitClientId: "cid-1" }])

    expect(next[0]?.items[0]?.clientId).toBe("cid-1")
    const merged = mergeChatItems(next.flatMap((p) => p.items), [], [pendingEntry], ME)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.message.id).toBe("server-1")
    expect(merged[0]?.pending).toBe(false)
  })

  it("replaces an edited message in place, in whichever page holds it", () => {
    const pages = [
      page([msg({ id: "m3", createdAt: "2026-01-01T00:00:03.000Z" })], "older"),
      page([msg({ id: "m1", createdAt: "2026-01-01T00:00:01.000Z", body: "helo" })]),
    ]
    const edited = msg({
      id: "m1",
      createdAt: "2026-01-01T00:00:01.000Z",
      body: "hello",
      editedAt: "2026-01-01T00:00:05.000Z",
    })

    const next = foldInboundIntoPages(pages, [{ message: edited }])

    expect(next[0]).toBe(pages[0])
    expect(next[1]?.items).toHaveLength(1)
    expect(next[1]?.items[0]?.body).toBe("hello")
    expect(next[1]?.items[0]?.editedAt).toBe("2026-01-01T00:00:05.000Z")
  })

  it("preserves the viewer's poll ballot when a room-wide neutral DTO replaces the cached copy", () => {
    const voted = msg({ id: "p1", createdAt: "t", poll: pollOf([1], [false, true], [0, 1]) })
    const pages = [page([voted])]
    const neutral = msg({ id: "p1", createdAt: "t", poll: pollOf([], [false, false], [2, 3]) })

    const next = foldInboundIntoPages(pages, [{ message: neutral }])

    const stored = next[0]?.items[0]
    expect(stored?.poll?.myVote).toEqual([1])
    expect(stored?.poll?.options.map((o) => o.mine)).toEqual([false, true])
    expect(stored?.poll?.options.map((o) => o.count)).toEqual([2, 3])
  })

  it("neutralizes a foreign actor's reaction `mine` flags against the local copy", () => {
    const local = msg({
      id: "m1",
      createdAt: "t",
      reactions: [{ emoji: "❤️", count: 1, mine: true }],
    })
    const pages = [page([local])]
    const actors = msg({
      id: "m1",
      createdAt: "t",
      reactions: [
        { emoji: "❤️", count: 2, mine: false },
        { emoji: "👍", count: 1, mine: true },
      ],
    })

    const next = foldInboundIntoPages(pages, [{ message: actors }])

    expect(next[0]?.items[0]?.reactions).toEqual([
      { emoji: "❤️", count: 2, mine: true },
      { emoji: "👍", count: 1, mine: false },
    ])
  })

  it("returns the same pages reference for an empty batch or empty pages", () => {
    const pages = [page([msg({ id: "m1", createdAt: "t" })])]
    expect(foldInboundIntoPages(pages, [])).toBe(pages)
    const empty: ChatHistoryResponse[] = []
    expect(foldInboundIntoPages(empty, [{ message: msg({ id: "m2", createdAt: "t" }) }])).toBe(empty)
  })

  it("drops an update for an UNKNOWN id older than the loaded window (no false adjacency at the top)", () => {
    const pages = [
      page([msg({ id: "m5", createdAt: "2026-01-05T00:00:00.000Z" })], "older"),
      page([msg({ id: "m4", createdAt: "2026-01-04T00:00:00.000Z" })], "even-older"),
    ]
    const ancientUpdate = msg({
      id: "m1",
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-06T00:00:00.000Z",
    })

    const next = foldInboundIntoPages(pages, [{ message: ancientUpdate }])

    expect(next).toBe(pages)
  })

  it("keeps a genuinely-new append (createdAt at/after the oldest cached item)", () => {
    const pages = [page([msg({ id: "m4", createdAt: "2026-01-04T00:00:00.000Z" })], "older")]
    const fresh = msg({ id: "m6", createdAt: "2026-01-06T00:00:00.000Z" })

    const next = foldInboundIntoPages(pages, [{ message: fresh }])

    expect(next[0]?.items.map((m) => m.id)).toEqual(["m4", "m6"])
  })

  it("still updates a KNOWN old message in place regardless of its age", () => {
    const pages = [
      page([msg({ id: "m5", createdAt: "2026-01-05T00:00:00.000Z" })], "older"),
      page([msg({ id: "m1", createdAt: "2026-01-01T00:00:00.000Z", body: "old" })]),
    ]
    const edited = msg({ id: "m1", createdAt: "2026-01-01T00:00:00.000Z", body: "new" })

    const next = foldInboundIntoPages(pages, [{ message: edited }])

    expect(next[1]?.items[0]?.body).toBe("new")
  })

  it("a viewer-truth ack folding over a neutral broadcast echo wins wholesale (reactions.mine + ballot)", () => {
    const neutralEcho = msg({
      id: "server-1",
      createdAt: "2026-01-01T00:00:01.000Z",
      fromId: ME,
      reactions: [{ emoji: "❤️", count: 1, mine: false }],
      poll: pollOf([], [false, false], [1, 0]),
    })
    const pages = [page([neutralEcho])]
    const ackMessage = msg({
      id: "server-1",
      createdAt: "2026-01-01T00:00:01.000Z",
      fromId: ME,
      reactions: [{ emoji: "❤️", count: 1, mine: true }],
      poll: pollOf([0], [true, false], [1, 0]),
    })

    const next = foldInboundIntoPages(pages, [
      { message: ackMessage, explicitClientId: "cid-1", viewerTruth: true },
    ])

    const stored = next[0]?.items[0]
    expect(stored?.reactions?.[0]?.mine).toBe(true)
    expect(stored?.poll?.myVote).toEqual([0])
    expect(stored?.poll?.options.map((o) => o.mine)).toEqual([true, false])
    expect(stored?.clientId).toBe("cid-1")
  })
})

describe("foldHistoryIntoPages", () => {
  it("adopts the viewer-scoped REST read wholesale (a fresh read IS viewer truth)", () => {
    const stale = msg({ id: "p1", createdAt: "t", poll: pollOf([], [false, false], [0, 0]) })
    const pages = [page([stale])]
    const fresh = msg({ id: "p1", createdAt: "t", poll: pollOf([0], [true, false], [1, 0]) })

    const next = foldHistoryIntoPages(pages, [fresh])

    expect(next[0]?.items[0]).toBe(fresh)
    expect(next[0]?.items[0]?.poll?.myVote).toEqual([0])
  })

  it("appends gap messages missed while the socket was down", () => {
    const pages = [page([msg({ id: "m1", createdAt: "2026-01-01T00:00:01.000Z" })])]
    const gap = [
      msg({ id: "m1", createdAt: "2026-01-01T00:00:01.000Z" }),
      msg({ id: "m2", createdAt: "2026-01-01T00:00:02.000Z" }),
      msg({ id: "m3", createdAt: "2026-01-01T00:00:03.000Z" }),
    ]

    const next = foldHistoryIntoPages(pages, gap)

    expect(next[0]?.items.map((m) => m.id)).toEqual(["m1", "m2", "m3"])
  })
})

describe("isFatalRoomErrorCode", () => {
  it("treats forbidden / not-found-class codes as room rejections", () => {
    expect(isFatalRoomErrorCode(ErrorCode.FORBIDDEN)).toBe(true)
    expect(isFatalRoomErrorCode(ErrorCode.NOT_FOUND)).toBe(true)
    expect(isFatalRoomErrorCode(ErrorCode.UNAUTHORIZED)).toBe(true)
  })

  it("treats transient and unknown codes as non-fatal so the room is never bricked", () => {
    expect(isFatalRoomErrorCode(ErrorCode.RATE_LIMITED)).toBe(false)
    expect(isFatalRoomErrorCode("BLOCKED")).toBe(false)
    expect(isFatalRoomErrorCode("BAD_FRAME")).toBe(false)
    expect(isFatalRoomErrorCode("channel_read_only")).toBe(false)
    expect(isFatalRoomErrorCode("reply_wrong_room")).toBe(false)
    expect(isFatalRoomErrorCode("SOME_FUTURE_CODE")).toBe(false)
  })
})

describe("replayableEntries", () => {
  const entry = (clientId: string, status: OutboxEntry["status"]): OutboxEntry => ({
    clientId,
    status,
    message: msg({ id: clientId, createdAt: "t", fromId: "me", clientId }),
  })

  it("replays sending entries and offline-failed entries exactly once each", () => {
    const outbox = [entry("c1", "sending"), entry("c2", "failed"), entry("c3", "failed")]
    const replay = replayableEntries(outbox, new Set(["c2"]))
    expect(replay.map((e) => e.clientId)).toEqual(["c1", "c2"])
  })

  it("never replays an entry the server rejected or that timed out (not offline-failed)", () => {
    const outbox = [entry("c1", "failed")]
    expect(replayableEntries(outbox, new Set())).toEqual([])
  })

  it("an acked entry is gone from the outbox, so a reconnect cannot double-send it", () => {
    const outbox: OutboxEntry[] = []
    expect(replayableEntries(outbox, new Set(["c1"]))).toEqual([])
  })

  it("NEVER replays an entry the socket core queued itself (flushQueue owns its delivery)", () => {
    const outbox = [entry("c1", "sending"), entry("c2", "sending"), entry("c3", "failed")]
    const replay = replayableEntries(outbox, new Set(["c3"]), new Set(["c1"]))
    expect(replay.map((e) => e.clientId)).toEqual(["c2", "c3"])
  })
})

describe("isSendRejectionErrorCode", () => {
  it("classifies every send-rejection code the gateway emits room-stamped", () => {
    for (const code of [
      "BAD_FRAME",
      "BLOCKED",
      "RATE_LIMITED",
      "VALIDATION",
      "channel_read_only",
      "reply_wrong_room",
      "reply_deleted_target",
    ]) {
      expect(isSendRejectionErrorCode(code), code).toBe(true)
    }
  })

  it("leaves unknown / non-send codes to the 12s ack timeout instead of failing in-flight sends", () => {
    expect(isSendRejectionErrorCode("SOME_FUTURE_CODE")).toBe(false)
    expect(isSendRejectionErrorCode("INTERNAL")).toBe(false)
    expect(isSendRejectionErrorCode(ErrorCode.FORBIDDEN)).toBe(false)
  })
})
