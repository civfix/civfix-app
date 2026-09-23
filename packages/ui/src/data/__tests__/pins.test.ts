/**
 * `mergePins` is the pure merge behind `useChat`'s derived pins list: the initial page's `pins` snapshot
 * overlaid with every loaded/live copy, deduped by id with the LATER (live) copy winning, filtered to a
 * truthy pinnedAt and sorted pinnedAt DESC.
 */
import { describe, expect, it } from "vitest"
import type { ChatMessageDTO, PersonDTO } from "@civfix/shared"
import { mergePins } from "../pins"

const ROOM = "room-1"

function person(id: string): PersonDTO {
  return { id, name: id, followers: 0, following: 0, isFollowing: false } as PersonDTO
}

function msg(
  partial: Partial<ChatMessageDTO> & { id: string },
): ChatMessageDTO {
  return {
    cleanupId: ROOM,
    from: person("user-other"),
    body: partial.id,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-07-18T09:00:00.000Z",
    ...partial,
  } as ChatMessageDTO
}

const ids = (pins: ChatMessageDTO[]) => pins.map((m) => m.id)

describe("mergePins", () => {
  it("returns empty for no pins anywhere", () => {
    expect(mergePins([], [])).toEqual([])
    expect(mergePins([], [msg({ id: "m1" }), msg({ id: "m2", pinnedAt: null })])).toEqual([])
  })

  it("passes the initial snapshot through, sorted pinnedAt DESC", () => {
    const older = msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z" })
    const newer = msg({ id: "m2", pinnedAt: "2026-07-18T11:00:00.000Z" })
    expect(ids(mergePins([older, newer], []))).toEqual(["m2", "m1"])
  })

  it("adds live/loaded messages with a truthy pinnedAt (message_update pin flip)", () => {
    const initial = [msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z" })]
    const live = [msg({ id: "m2", pinnedAt: "2026-07-18T12:00:00.000Z" }), msg({ id: "m3" })]
    expect(ids(mergePins(initial, live))).toEqual(["m2", "m1"])
  })

  it("dedupes by id with the live copy winning over the initial snapshot", () => {
    const initial = [msg({ id: "m1", body: "stale", pinnedAt: "2026-07-18T10:00:00.000Z" })]
    const live = [msg({ id: "m1", body: "fresh", pinnedAt: "2026-07-18T10:00:00.000Z" })]
    const merged = mergePins(initial, live)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.body).toBe("fresh")
  })

  it("later live copies win over earlier ones (history item superseded by the WS copy)", () => {
    const history = msg({ id: "m1", body: "history", pinnedAt: "2026-07-18T10:00:00.000Z" })
    const ws = msg({ id: "m1", body: "ws", pinnedAt: "2026-07-18T10:30:00.000Z" })
    const merged = mergePins([], [history, ws])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.body).toBe("ws")
  })

  it("removes an initial pin whose live copy arrived unpinned (pinnedAt null)", () => {
    const initial = [
      msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z" }),
      msg({ id: "m2", pinnedAt: "2026-07-18T11:00:00.000Z" }),
    ]
    const live = [msg({ id: "m1", pinnedAt: null })]
    expect(ids(mergePins(initial, live))).toEqual(["m2"])
  })

  it("a live copy with pinnedAt UNDEFINED also unpins its initial-snapshot twin", () => {
    // An update DTO from an older code path may omit the field entirely; the live copy is still
    // the authoritative one, so the pin drops rather than resurrecting the stale snapshot.
    const initial = [msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z" })]
    const live = [msg({ id: "m1" })]
    expect(mergePins(initial, live)).toEqual([])
  })

  it("a message_update tombstone for a pinned message removes it from the merged pins", () => {
    // Soft-delete does NOT clear pinned_at server-side, but the server's pin list excludes
    // tombstones. The client merge must match, or a deleted pin ghosts in the PinnedBar with
    // the empty-body "Photo" excerpt fallback.
    const initial = [
      msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z" }),
      msg({ id: "m2", pinnedAt: "2026-07-18T11:00:00.000Z" }),
    ]
    const tombstone = msg({
      id: "m2",
      body: "",
      pinnedAt: "2026-07-18T11:00:00.000Z",
      deletedAt: "2026-07-18T12:00:00.000Z",
    })
    expect(ids(mergePins(initial, [tombstone]))).toEqual(["m1"])
  })

  it("a tombstone in the initial snapshot itself is excluded (defensive)", () => {
    const initial = [
      msg({ id: "m1", pinnedAt: "2026-07-18T10:00:00.000Z", deletedAt: "2026-07-18T12:00:00.000Z" }),
    ]
    expect(mergePins(initial, [])).toEqual([])
  })

  it("sorts merged pins pinnedAt DESC across both sources, id-stable on ties", () => {
    const initial = [msg({ id: "b", pinnedAt: "2026-07-18T10:00:00.000Z" })]
    const live = [
      msg({ id: "c", pinnedAt: "2026-07-18T12:00:00.000Z" }),
      msg({ id: "a", pinnedAt: "2026-07-18T10:00:00.000Z" }),
    ]
    expect(ids(mergePins(initial, live))).toEqual(["c", "a", "b"])
  })
})
