import { describe, expect, it } from "vitest"
import type { ChatMessageDTO } from "@civfix/shared"
import { pinnedRenderRows } from "../conversationModel"

function pin(id: string, fromId: string | null, kind: ChatMessageDTO["kind"] = "text"): ChatMessageDTO {
  return {
    id,
    from: fromId ? { id: fromId, name: fromId } : null,
    body: id,
    kind,
    attachments: [],
    reactions: [],
    mentions: [],
    createdAt: "2026-07-18T09:00:00.000Z",
  } as unknown as ChatMessageDTO
}

describe("pinnedRenderRows", () => {
  it("renders every pin as its own settled, standalone row", () => {
    const rows = pinnedRenderRows([pin("m1", "a"), pin("m2", "b")], "me", true)
    expect(rows.map((row) => row.id)).toEqual(["m1", "m2"])
    for (const row of rows) {
      expect(row.type).toBe("row")
      if (row.type !== "row") continue
      expect(row.groupStart).toBe(true)
      expect(row.groupEnd).toBe(true)
      expect(row.item.pending).toBe(false)
      expect(row.item.failed).toBe(false)
    }
  })

  it("marks the viewer's own pins as mine and never names them", () => {
    const [row] = pinnedRenderRows([pin("m1", "me")], "me", true)
    expect(row?.type === "row" && row.item.mine).toBe(true)
    expect(row?.type === "row" && row.showName).toBe(false)
  })

  it("names others only in group rooms, and never on a system row", () => {
    const rows = (isGroup: boolean) => pinnedRenderRows([pin("m1", "a"), pin("m2", "a", "system")], "me", isGroup)
    expect(rows(true).map((row) => row.type === "row" && row.showName)).toEqual([true, false])
    expect(rows(false).map((row) => row.type === "row" && row.showName)).toEqual([false, false])
  })

  it("treats every pin as someone else's when the viewer is signed out", () => {
    const [row] = pinnedRenderRows([pin("m1", "a")], null, true)
    expect(row?.type === "row" && row.item.mine).toBe(false)
  })
})
