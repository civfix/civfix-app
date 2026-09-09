import { describe, expect, it } from "vitest"
import type { ChatItem } from "@civfix/shared"
import { aroundWindowState } from "../conversation/aroundWindowState"

const item = { message: { id: "m1" }, mine: false, pending: false, failed: false } as unknown as ChatItem

describe("aroundWindowState", () => {
  it("no window at all is inactive - the merged transcript renders", () => {
    expect(aroundWindowState(null)).toBe("inactive")
  })

  it("a window that landed EMPTY is dead, never a renderable window", () => {
    expect(aroundWindowState([])).toBe("dead")
  })

  it("a window with rows is active", () => {
    expect(aroundWindowState([item])).toBe("active")
  })
})
