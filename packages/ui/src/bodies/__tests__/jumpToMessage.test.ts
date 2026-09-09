import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import type { ChatItem, ChatMessageDTO } from "@civfix/shared"
import type { RenderItem } from "../ConversationBody"
import { resolveJump } from "../jumpToMessage"

function chatItem(id: string, clientId?: string): ChatItem {
  const message = {
    id,
    cleanupId: "room-1",
    from: { id: "u1", name: "Ada", followers: 0, following: 0, isFollowing: false },
    body: id,
    kind: "text",
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-07-18T12:00:00.000Z",
    ...(clientId ? { clientId } : {}),
  } as unknown as ChatMessageDTO
  return { message, pending: false, failed: false, mine: Boolean(clientId) }
}

function row(id: string, clientId?: string): RenderItem {
  const item = chatItem(id, clientId)
  return {
    type: "row",
    id: item.message.clientId ?? item.message.id,
    item,
    showName: false,
    groupStart: false,
    groupEnd: false,
  }
}

function sep(dk: string): RenderItem {
  return { type: "sep", id: `sep-${dk}`, label: dk }
}

const rows: RenderItem[] = [
  { type: "typing", id: "typing", name: null, color: "#000" },
  row("m4"),
  row("m3"),
  sep("2026-07-18"),
  row("m2", "c-m2"),
  row("m1"),
  sep("2026-07-17"),
]

describe("resolveJump", () => {
  it("returns the row's index in the inverted render array when the target is present", () => {
    expect(resolveJump("m4", rows)).toEqual({ type: "scroll", index: 1 })
    expect(resolveJump("m3", rows)).toEqual({ type: "scroll", index: 2 })
  })

  it("index math accounts for separators and the typing row (positions, not message ordinals)", () => {
    expect(resolveJump("m2", rows)).toEqual({ type: "scroll", index: 4 })
    expect(resolveJump("m1", rows)).toEqual({ type: "scroll", index: 5 })
  })

  it("matches by server message id even when the RenderItem key is the clientId", () => {
    const res = resolveJump("m2", rows)
    expect(res).toEqual({ type: "scroll", index: 4 })
    expect(resolveJump("c-m2", rows)).toEqual({ type: "fetch" })
  })

  it("returns fetch when the target is not in the rendered rows", () => {
    expect(resolveJump("m-ancient", rows)).toEqual({ type: "fetch" })
  })

  it("never matches separator or typing rows, even on id collision", () => {
    expect(resolveJump("sep-2026-07-18", rows)).toEqual({ type: "fetch" })
    expect(resolveJump("typing", rows)).toEqual({ type: "fetch" })
  })

  it("returns fetch on an empty row array", () => {
    expect(resolveJump("m1", [])).toEqual({ type: "fetch" })
  })
})

describe("useJumpToMessage room-change hygiene", () => {
  const SRC = readFileSync(
    join(__dirname, "..", "conversation", "useJumpToMessage.ts"),
    "utf8",
  )

  it("resets the pending jump, loading id and flash when the room changes (no cross-room 'jump failed' toast)", () => {
    expect(SRC).toContain("const activeRoomRef = useRef(roomId)")
    expect(SRC).toContain("if (activeRoomRef.current === roomId) return")
    expect(SRC).toContain("pendingJumpRef.current = null")
    expect(SRC).toContain("setJumpLoadingId(null)")
    expect(SRC).toContain("setFlashMessageId(null)")
  })
})
