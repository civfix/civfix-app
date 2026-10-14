import { describe, it, expect } from "vitest"
import { WsServerMessageSchema, MESSAGE_BODY_MAX, EDIT_WINDOW_HOURS } from "../src/types/ws.js"
import { EditMessageRequestSchema } from "../src/schemas/chat.js"

/**
 * Chat edit contract: the message_update server frame (full refreshed DTO, upsert-by-id), the unified
 * roomKind-scoped edit request, and the body limit + edit window constants shared by the gateway, REST
 * layer, and both clients.
 */

const ROOM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "11111111-1111-1111-1111-111111111111"

const MESSAGE = {
  id: ROOM,
  cleanupId: ROOM,
  from: { id: USER, name: "U", handle: null, bio: null, avatar: null, followers: 0, following: 0, isFollowing: false },
  body: "hi",
  kind: "text",
  attachments: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  editedAt: null,
}

describe("message_update server frame", () => {
  it("accepts a message_update frame carrying the refreshed DTO", () => {
    const parsed = WsServerMessageSchema.safeParse({
      type: "message_update",
      roomKind: "report",
      roomId: ROOM,
      message: MESSAGE,
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a message_update frame with an unknown roomKind", () => {
    const parsed = WsServerMessageSchema.safeParse({
      type: "message_update",
      roomKind: "bogus",
      roomId: ROOM,
      message: MESSAGE,
    })
    expect(parsed.success).toBe(false)
  })
})

describe("EditMessageRequestSchema", () => {
  const base = { roomKind: "dm", roomId: ROOM, messageId: ROOM }

  it("accepts a body at the 2000-char limit", () => {
    const parsed = EditMessageRequestSchema.safeParse({ ...base, body: "a".repeat(2000) })
    expect(parsed.success).toBe(true)
  })

  it("rejects a body over the 2000-char limit", () => {
    const parsed = EditMessageRequestSchema.safeParse({ ...base, body: "a".repeat(2001) })
    expect(parsed.success).toBe(false)
  })
})

describe("chat constants", () => {
  it("MESSAGE_BODY_MAX is 2000", () => {
    expect(MESSAGE_BODY_MAX).toBe(2000)
  })

  it("EDIT_WINDOW_HOURS is 48", () => {
    expect(EDIT_WINDOW_HOURS).toBe(48)
  })
})
