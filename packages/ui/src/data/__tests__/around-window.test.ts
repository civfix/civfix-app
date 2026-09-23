/**
 * `applyUpdatesToWindow` is the pure fold `useChat` runs over its detached around-mode window when
 * `message_update` frames arrive: it upserts by id the messages ALREADY in the window (edits,
 * tombstones) and drops anything else, so a detached window never grows.
 */
import { describe, expect, it } from "vitest"
import type { ChatItem, ChatMessageDTO, PersonDTO } from "@civfix/shared"
import { applyUpdatesToWindow } from "../aroundWindow"

function person(id: string): PersonDTO {
  return { id, name: id, followers: 0, following: 0, isFollowing: false } as PersonDTO
}

function msg(partial: Partial<ChatMessageDTO> & { id: string }): ChatMessageDTO {
  return {
    cleanupId: "room-1",
    from: person("u-other"),
    body: partial.id,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-07-18T10:00:00.000Z",
    ...partial,
  } as ChatMessageDTO
}

function item(message: ChatMessageDTO, mine = false): ChatItem {
  return { message, pending: false, failed: false, mine }
}

const window: ChatItem[] = [
  item(msg({ id: "m1", body: "first" })),
  item(msg({ id: "m2", body: "second" }), true),
  item(msg({ id: "m3", body: "third" })),
]

describe("applyUpdatesToWindow", () => {
  it("applies an edit to an existing window message in place (order + row flags kept)", () => {
    const edited = msg({ id: "m2", body: "second, edited", editedAt: "2026-07-18T11:00:00.000Z" })
    const next = applyUpdatesToWindow(window, [edited])

    expect(next).toHaveLength(3)
    expect(next.map((it) => it.message.id)).toEqual(["m1", "m2", "m3"])
    expect(next[1]?.message.body).toBe("second, edited")
    expect(next[1]?.message.editedAt).toBe("2026-07-18T11:00:00.000Z")
    // Row flags survive the DTO swap: this is still the viewer's own message.
    expect(next[1]?.mine).toBe(true)
    // Untouched rows keep their identity (no gratuitous re-render churn).
    expect(next[0]).toBe(window[0])
    expect(next[2]).toBe(window[2])
  })

  it("applies a delete: the tombstoned DTO replaces the live copy", () => {
    const tombstone = msg({ id: "m3", body: "", deletedAt: "2026-07-18T11:30:00.000Z" })
    const next = applyUpdatesToWindow(window, [tombstone])

    expect(next[2]?.message.deletedAt).toBe("2026-07-18T11:30:00.000Z")
    expect(next[2]?.message.body).toBe("")
    expect(next).toHaveLength(3)
  })

  it("does NOT append a new message whose id is not in the window", () => {
    const newcomer = msg({ id: "m99", body: "live arrival" })
    const next = applyUpdatesToWindow(window, [newcomer])

    expect(next).toHaveLength(3)
    expect(next.some((it) => it.message.id === "m99")).toBe(false)
    // Pure no-op: the SAME array reference comes back, so setState skips the re-render.
    expect(next).toBe(window)
  })

  it("mixed batch: applies matches, drops the rest", () => {
    const edited = msg({ id: "m1", body: "first, edited", editedAt: "2026-07-18T12:00:00.000Z" })
    const newcomer = msg({ id: "m50", body: "not in window" })
    const next = applyUpdatesToWindow(window, [newcomer, edited])

    expect(next).toHaveLength(3)
    expect(next[0]?.message.body).toBe("first, edited")
    expect(next.some((it) => it.message.id === "m50")).toBe(false)
    expect(next).not.toBe(window)
  })

  it("empty batch is an identity no-op", () => {
    expect(applyUpdatesToWindow(window, [])).toBe(window)
  })
})
