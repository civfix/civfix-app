import { describe, it, expect } from "vitest"
import {
  ChatMessageKindSchema,
  ChatMessageDTOSchema,
  PollDTOSchema,
} from "../src/schemas/entities.js"
import {
  PollRoomKindSchema,
  CreatePollRequestSchema,
  VotePollRequestSchema,
  ClosePollRequestSchema,
} from "../src/schemas/chat.js"
import { endpoints } from "../src/client/endpoints.js"

/**
 * Chat P6 contract: polls — the "poll" message kind + PollDTO payload on ChatMessageDTO, plus the
 * create/vote/close request schemas and the 3-route /messages/poll* surface.
 */

const ROOM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MSG = "cccccccc-cccc-cccc-cccc-cccccccccccc"

describe("ChatMessageKindSchema gains 'poll'", () => {
  it("parses 'poll'", () => {
    expect(ChatMessageKindSchema.safeParse("poll").success).toBe(true)
  })

  it("still rejects unknown kinds", () => {
    expect(ChatMessageKindSchema.safeParse("bogus").success).toBe(false)
  })
})

describe("PollRoomKindSchema", () => {
  it("accepts cleanup/report/group", () => {
    expect(PollRoomKindSchema.safeParse("cleanup").success).toBe(true)
    expect(PollRoomKindSchema.safeParse("report").success).toBe(true)
    expect(PollRoomKindSchema.safeParse("group").success).toBe(true)
  })

  it("rejects 'dm' (no audience to poll in a two-party thread)", () => {
    expect(PollRoomKindSchema.safeParse("dm").success).toBe(false)
  })
})

describe("CreatePollRequestSchema", () => {
  const base = {
    roomKind: "group" as const,
    roomId: ROOM,
    question: "Which day?",
    options: ["Sat", "Sun"],
  }

  it("applies defaults: allowMultiple=false, anonymous=true", () => {
    const parsed = CreatePollRequestSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.allowMultiple).toBe(false)
      expect(parsed.data.anonymous).toBe(true)
    }
  })

  it("rejects fewer than 2 options", () => {
    expect(CreatePollRequestSchema.safeParse({ ...base, options: ["only"] }).success).toBe(false)
  })

  it("rejects more than 10 options", () => {
    expect(
      CreatePollRequestSchema.safeParse({ ...base, options: Array(11).fill("x") }).success,
    ).toBe(false)
  })

  it("rejects roomKind 'dm'", () => {
    expect(CreatePollRequestSchema.safeParse({ ...base, roomKind: "dm" }).success).toBe(false)
  })

  it("rejects a question longer than 300 chars", () => {
    expect(CreatePollRequestSchema.safeParse({ ...base, question: "q".repeat(301) }).success).toBe(
      false,
    )
  })

  it("rejects extra keys (strict)", () => {
    expect(CreatePollRequestSchema.safeParse({ ...base, extra: 1 }).success).toBe(false)
  })
})

describe("VotePollRequestSchema", () => {
  it("accepts a normal ballot", () => {
    expect(VotePollRequestSchema.safeParse({ messageId: MSG, optionIdxs: [0, 2] }).success).toBe(true)
  })

  it("accepts an empty array (retract)", () => {
    expect(VotePollRequestSchema.safeParse({ messageId: MSG, optionIdxs: [] }).success).toBe(true)
  })

  it("rejects an option idx of 10 (max idx is 9)", () => {
    expect(VotePollRequestSchema.safeParse({ messageId: MSG, optionIdxs: [10] }).success).toBe(false)
  })

  it("rejects more than 10 idxs", () => {
    expect(
      VotePollRequestSchema.safeParse({ messageId: MSG, optionIdxs: Array(11).fill(0) }).success,
    ).toBe(false)
  })
})

describe("ClosePollRequestSchema", () => {
  it("accepts a messageId, rejects extra keys", () => {
    expect(ClosePollRequestSchema.safeParse({ messageId: MSG }).success).toBe(true)
    expect(ClosePollRequestSchema.safeParse({ messageId: MSG, extra: 1 }).success).toBe(false)
  })
})

describe("PollDTO on ChatMessageDTO", () => {
  const poll = {
    question: "Which day?",
    options: [
      { idx: 0, text: "Sat", count: 3, mine: true },
      { idx: 1, text: "Sun", count: 1, mine: false },
    ],
    allowMultiple: false,
    anonymous: true,
    closed: false,
    totalVoters: 4,
    myVote: [0],
  }

  it("PollDTOSchema round-trips", () => {
    const parsed = PollDTOSchema.safeParse(poll)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toEqual(poll)
  })

  it("a kind 'poll' ChatMessageDTO with a poll payload parses", () => {
    const parsed = ChatMessageDTOSchema.safeParse({
      id: MSG,
      cleanupId: ROOM,
      kind: "poll",
      createdAt: "2026-01-01T00:00:00.000Z",
      poll,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe("poll")
      expect(parsed.data.poll?.totalVoters).toBe(4)
    }
  })

  it("poll is optional on non-poll messages", () => {
    expect(
      ChatMessageDTOSchema.safeParse({
        id: MSG,
        cleanupId: ROOM,
        kind: "text",
        body: "hi",
        createdAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(true)
  })
})

describe("poll endpoints registration", () => {
  it("registers the 3 /messages/poll routes with the right method/path/csrf", () => {
    const expected: Array<[keyof typeof endpoints, string, string]> = [
      ["createPoll", "POST", "/messages/poll"],
      ["votePoll", "PUT", "/messages/poll/vote"],
      ["closePoll", "POST", "/messages/poll/close"],
    ]
    for (const [name, method, path] of expected) {
      const e = endpoints[name]
      expect(e.method).toBe(method)
      expect(e.path).toBe(path)
      expect(e.csrf).toBe(true)
      expect(e.auth).toBe("required")
      expect(e.version).toBe("v1")
      expect(e.response).toBe(ChatMessageDTOSchema)
    }
  })
})
