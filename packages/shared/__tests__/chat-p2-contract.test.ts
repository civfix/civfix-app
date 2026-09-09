import { describe, it, expect } from "vitest"
import { WsClientMessageSchema } from "../src/types/ws.js"
import { ChatMessageDTOSchema } from "../src/schemas/entities.js"
import {
  ChatHistoryQuerySchema,
  ChatHistoryRequestSchema,
  ChatHistoryResponseSchema,
  DmHistoryQuerySchema,
  DmHistoryRequestSchema,
  ReportChatHistoryRequestSchema,
} from "../src/schemas/chat.js"

/**
 * Chat P2 contract: reply threading (ReplyToDTO nested on the message DTO, replyToId on the WS
 * send frame) and around-mode history (center-window fetch, mutually exclusive with `before`,
 * with a prevCursor toward newer messages on the response).
 */

const ROOM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MSG = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const USER = "11111111-1111-1111-1111-111111111111"

describe("around-mode history queries", () => {
  const cases: Array<[string, { safeParse: (v: unknown) => { success: boolean } }, Record<string, string>]> = [
    ["ChatHistoryQuerySchema", ChatHistoryQuerySchema, {}],
    ["ChatHistoryRequestSchema", ChatHistoryRequestSchema, { cleanupId: ROOM }],
    ["DmHistoryQuerySchema", DmHistoryQuerySchema, {}],
    ["DmHistoryRequestSchema", DmHistoryRequestSchema, { threadId: ROOM }],
    ["ReportChatHistoryRequestSchema", ReportChatHistoryRequestSchema, { id: ROOM }],
  ]

  for (const [name, schema, base] of cases) {
    it(`${name} accepts around alone`, () => {
      expect(schema.safeParse({ ...base, around: MSG }).success).toBe(true)
    })
    it(`${name} rejects around together with before`, () => {
      expect(schema.safeParse({ ...base, around: MSG, before: MSG }).success).toBe(false)
    })
    it(`${name} still accepts before alone (back-compat)`, () => {
      expect(schema.safeParse({ ...base, before: MSG }).success).toBe(true)
    })
  }

  it("history response accepts prevCursor, and tolerates its absence (back-compat)", () => {
    expect(
      ChatHistoryResponseSchema.safeParse({ items: [], nextCursor: null, prevCursor: "c1" }).success,
    ).toBe(true)
    expect(ChatHistoryResponseSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true)
  })
})

describe("reply threading DTO", () => {
  const MESSAGE = {
    id: MSG,
    cleanupId: ROOM,
    from: null,
    body: "sounds good",
    kind: "text",
    attachments: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }

  it("parses a ChatMessageDTO with a nested replyTo preview", () => {
    const parsed = ChatMessageDTOSchema.safeParse({
      ...MESSAGE,
      replyToId: ROOM,
      replyTo: {
        id: ROOM,
        from: { id: USER, displayName: "Ursula" },
        excerpt: "Photo",
        kind: "share_pin",
        deleted: true,
      },
    })
    expect(parsed.success).toBe(true)
  })

  it("parses a ChatMessageDTO without reply fields (back-compat)", () => {
    expect(ChatMessageDTOSchema.safeParse(MESSAGE).success).toBe(true)
  })
})

describe("send frame replyToId", () => {
  const SEND = { type: "send", cleanupId: ROOM, clientId: "c1", body: "hi" }

  it("accepts a send frame with replyToId", () => {
    expect(WsClientMessageSchema.safeParse({ ...SEND, replyToId: MSG }).success).toBe(true)
  })

  it("accepts a send frame without replyToId (back-compat)", () => {
    expect(WsClientMessageSchema.safeParse(SEND).success).toBe(true)
  })

  it("rejects a non-id replyToId", () => {
    expect(WsClientMessageSchema.safeParse({ ...SEND, replyToId: "not-an-id" }).success).toBe(false)
  })
})
