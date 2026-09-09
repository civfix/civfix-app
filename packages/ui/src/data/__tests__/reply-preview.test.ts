/**
 * Unit tests for `buildLocalReplyTo` (chat P2, Task 2.6) - the pure optimistic reply-preview builder
 * `useChat.send` uses so a reply's quote strip paints before the server echo lands.
 */
import { describe, expect, it } from "vitest"
import type { ChatMessageDTO, PersonDTO } from "@civfix/shared"
import { buildLocalReplyTo, REPLY_EXCERPT_MAX } from "../replyPreview"

function person(id: string, name: string): PersonDTO {
  return { id, name, followers: 0, following: 0, isFollowing: false } as PersonDTO
}

function msg(partial: Partial<ChatMessageDTO> & { id: string }): ChatMessageDTO {
  return {
    cleanupId: "room-1",
    from: person("u1", "Ada Lovelace"),
    body: "hello there",
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-07-18T12:00:00.000Z",
    ...partial,
  } as ChatMessageDTO
}

describe("buildLocalReplyTo", () => {
  it("maps id, kind, and from (PersonDTO.name -> displayName)", () => {
    expect(buildLocalReplyTo(msg({ id: "m1" }))).toEqual({
      id: "m1",
      from: { id: "u1", displayName: "Ada Lovelace" },
      excerpt: "hello there",
      kind: "text",
      deleted: false,
    })
  })

  it("truncates the excerpt to the first 120 chars", () => {
    const body = "x".repeat(300)
    const out = buildLocalReplyTo(msg({ id: "m1", body }))
    expect(out.excerpt).toBe("x".repeat(REPLY_EXCERPT_MAX))
    expect(out.excerpt.length).toBe(120)
  })

  it("keeps a body at exactly the cap intact", () => {
    const body = "y".repeat(REPLY_EXCERPT_MAX)
    expect(buildLocalReplyTo(msg({ id: "m1", body })).excerpt).toBe(body)
  })

  it("truncates by code point, never splitting a surrogate pair at the cap", () => {
    // 119 BMP chars + astral emoji: a UTF-16 slice at 120 would cut the first emoji in half,
    // leaving a lone high surrogate. The code-point slice keeps it whole.
    const body = "a".repeat(REPLY_EXCERPT_MAX - 1) + "\u{1F600}\u{1F600}\u{1F600}"
    const out = buildLocalReplyTo(msg({ id: "m1", body })).excerpt
    expect(out).toBe("a".repeat(REPLY_EXCERPT_MAX - 1) + "\u{1F600}")
    expect(Array.from(out)).toHaveLength(REPLY_EXCERPT_MAX)
    // No lone HIGH surrogate at the boundary (the emoji's trailing low surrogate is paired).
    const last = out.charCodeAt(out.length - 1)
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false)
  })

  it("empty and null bodies collapse to an empty excerpt (attachment-only originals)", () => {
    expect(buildLocalReplyTo(msg({ id: "m1", body: "" })).excerpt).toBe("")
    expect(buildLocalReplyTo(msg({ id: "m1", body: null })).excerpt).toBe("")
    expect(buildLocalReplyTo(msg({ id: "m1", body: undefined })).excerpt).toBe("")
  })

  it("null from stays null (deleted author account)", () => {
    expect(buildLocalReplyTo(msg({ id: "m1", from: null })).from).toBeNull()
  })

  it("is never deleted - you can only reply to a message that exists right now", () => {
    expect(buildLocalReplyTo(msg({ id: "m1" })).deleted).toBe(false)
  })
})
