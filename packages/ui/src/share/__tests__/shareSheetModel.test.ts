import { describe, expect, it } from "vitest"
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import {
  SHARE_RECIPIENTS_MAX_HEIGHT,
  isShareRecipient,
  shareCopyTileFace,
  sharePeopleView,
  shareRecipientsSizing,
  shareSheetFooter,
} from "../shareSheetModel"

const result = (id: string): UserSearchResultDTO => ({
  id,
  handle: id,
  displayName: id.toUpperCase(),
  avatar: ["#000000", "#111111"],
  avatarUrl: null,
})

const person = (id: string): PersonDTO =>
  ({ id, name: id, handle: id, avatar: ["#000000", "#111111"], avatarUrl: null }) as unknown as PersonDTO

describe("sharePeopleView", () => {
  it("shows the recents row while nothing is typed", () => {
    const view = sharePeopleView({ query: "", suggested: [result("a"), result("b")], results: [result("z")] })
    expect(view.mode).toBe("recent")
    expect(view.rows.map((r) => r.id)).toEqual(["a", "b"])
  })

  it("prompts for a handle when there are no recents and nothing typed", () => {
    expect(sharePeopleView({ query: "", suggested: [], results: [] })).toEqual({ mode: "prompt", rows: [] })
  })

  it("switches to search results as soon as a handle is typed, even with recents available", () => {
    const view = sharePeopleView({ query: "z", suggested: [result("a")], results: [result("z")] })
    expect(view.mode).toBe("results")
    expect(view.rows.map((r) => r.id)).toEqual(["z"])
  })

  it("never offers the viewer themselves, in either mode", () => {
    const me = ["me"]
    expect(sharePeopleView({ query: "", suggested: [result("me"), result("a")], results: [], excludeIds: me }).rows.map((r) => r.id)).toEqual(["a"])
    expect(sharePeopleView({ query: "m", suggested: [], results: [result("me")], excludeIds: me })).toEqual({ mode: "results", rows: [] })
  })
})

describe("shareSheetFooter", () => {
  it("swaps the action tiles for the compose bar once someone is picked", () => {
    expect(shareSheetFooter(true, 0)).toBe("actions")
    expect(shareSheetFooter(true, 1)).toBe("compose")
  })

  it("keeps a guest on the action tiles no matter what", () => {
    expect(shareSheetFooter(false, 0)).toBe("actions")
    expect(shareSheetFooter(false, 3)).toBe("actions")
  })
})

describe("isShareRecipient", () => {
  it("matches by id only", () => {
    expect(isShareRecipient([person("a"), person("b")], "b")).toBe(true)
    expect(isShareRecipient([person("a")], "c")).toBe(false)
  })
})

describe("the copy-link tile confirms inline, since a toast would land behind the sheet's own Modal", () => {
  const labels = { idle: "Copy link", copied: "Link copied", failed: "Couldn't copy" }

  it("rests as the copy affordance", () => {
    expect(shareCopyTileFace("idle", labels)).toEqual({ icon: "Copy", label: "Copy link", tone: "default" })
  })

  it("flips to a check with the copied label after a real clipboard write", () => {
    expect(shareCopyTileFace("copied", labels)).toEqual({ icon: "Check", label: "Link copied", tone: "success" })
  })

  it("says so, in place, when the clipboard write failed", () => {
    expect(shareCopyTileFace("failed", labels)).toEqual({ icon: "Close", label: "Couldn't copy", tone: "danger" })
  })
})

describe("shareRecipientsSizing - the one region that gives up space when the sheet shrinks", () => {
  it("makes the vertical results list shrinkable, with NO floor under it", () => {
    const sizing = shareRecipientsSizing("results")
    expect(sizing.flexShrink).toBe(1)
    expect(sizing.minHeight).toBe(0)
  })

  it("still caps the results list, so a long match list leaves the sheet compact", () => {
    expect(shareRecipientsSizing("results").maxHeight).toBe(SHARE_RECIPIENTS_MAX_HEIGHT)
    expect(SHARE_RECIPIENTS_MAX_HEIGHT).toBeGreaterThan(0)
  })

  it("leaves the recents strip and the empty prompt at their content height", () => {
    for (const mode of ["recent", "prompt"] as const) {
      expect(shareRecipientsSizing(mode), mode).toEqual({ flexShrink: 0, minHeight: 0 })
    }
  })

  it("never caps a region it does not also allow to shrink", () => {
    for (const mode of ["recent", "results", "prompt"] as const) {
      const sizing = shareRecipientsSizing(mode)
      if (sizing.maxHeight !== undefined) expect(sizing.flexShrink, mode).toBe(1)
    }
  })

  it("returns ONE object per mode, so the list's style prop does not churn every render", () => {
    expect(shareRecipientsSizing("results")).toBe(shareRecipientsSizing("results"))
    expect(shareRecipientsSizing("recent")).toBe(shareRecipientsSizing("prompt"))
  })
})
