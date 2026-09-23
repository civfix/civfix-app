import { describe, it, expect } from "vitest"
import { ChatMessageDTOSchema } from "../src/schemas/entities.js"
import {
  ChatHistoryResponseSchema,
  DmHistoryResponseSchema,
  SetMessagePinnedRequestSchema,
} from "../src/schemas/chat.js"
import { endpoints } from "../src/client/endpoints.js"

/**
 * Chat pin contract: pinnedAt on the message DTO, the unified roomKind-scoped
 * setMessagePinned endpoint, and `pins` on initial history pages (full DTOs, pinned_at DESC, cap 25).
 */

const ROOM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MSG = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

const MESSAGE = {
  id: MSG,
  cleanupId: ROOM,
  from: null,
  body: "pin me",
  kind: "text",
  attachments: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

describe("SetMessagePinnedRequestSchema", () => {
  const base = { roomKind: "cleanup", roomId: ROOM, messageId: MSG, pinned: true }

  it("parses a valid pin request", () => {
    expect(SetMessagePinnedRequestSchema.safeParse(base).success).toBe(true)
  })

  it("parses an unpin request", () => {
    expect(SetMessagePinnedRequestSchema.safeParse({ ...base, pinned: false }).success).toBe(true)
  })

  it("rejects extra keys (strict)", () => {
    expect(SetMessagePinnedRequestSchema.safeParse({ ...base, extra: "nope" }).success).toBe(false)
  })

  it("rejects a missing pinned flag", () => {
    const { pinned: _pinned, ...rest } = base
    expect(SetMessagePinnedRequestSchema.safeParse(rest).success).toBe(false)
  })
})

describe("pinnedAt on ChatMessageDTO", () => {
  it("parses a message with pinnedAt", () => {
    expect(
      ChatMessageDTOSchema.safeParse({ ...MESSAGE, pinnedAt: "2026-01-02T00:00:00.000Z" }).success,
    ).toBe(true)
  })

  it("parses a message with pinnedAt null (unpinned)", () => {
    expect(ChatMessageDTOSchema.safeParse({ ...MESSAGE, pinnedAt: null }).success).toBe(true)
  })

  it("parses a message without pinnedAt (back-compat)", () => {
    expect(ChatMessageDTOSchema.safeParse(MESSAGE).success).toBe(true)
  })
})

describe("pins on history responses", () => {
  it("history response accepts a pins array of full message DTOs", () => {
    expect(
      ChatHistoryResponseSchema.safeParse({
        items: [],
        nextCursor: null,
        pins: [{ ...MESSAGE, pinnedAt: "2026-01-02T00:00:00.000Z" }],
      }).success,
    ).toBe(true)
  })

  it("history response tolerates absence of pins (back-compat / non-initial pages)", () => {
    expect(ChatHistoryResponseSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true)
  })

  it("DM history response (alias) inherits pins", () => {
    expect(
      DmHistoryResponseSchema.safeParse({
        items: [],
        nextCursor: null,
        pins: [{ ...MESSAGE, pinnedAt: "2026-01-02T00:00:00.000Z" }],
      }).success,
    ).toBe(true)
  })
})

describe("setMessagePinned endpoint", () => {
  it("is registered as PUT /messages/pin, auth required, csrf, v1", () => {
    const e = endpoints.setMessagePinned
    expect(e.method).toBe("PUT")
    expect(e.path).toBe("/messages/pin")
    expect(e.auth).toBe("required")
    expect(e.csrf).toBe(true)
    expect(e.version).toBe("v1")
  })
})
