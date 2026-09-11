import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import {
  buildInlineComposerModel,
  composerEntryFor,
  inlineComposerClosesOnBlur,
  inlineComposerOwnsDraft,
} from "../inlineComposerModel"

const EN: Record<string, string> = {
  "mode.post.placeholder": "Share an update with your neighborhood...",
  "action.post": "Post",
  "action.posting": "Posting...",
}

const t = ((key: string) => {
  const resolved = EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved
}) as unknown as TFunction

const model = (over: Partial<Parameters<typeof buildInlineComposerModel>[0]> = {}) =>
  buildInlineComposerModel(
    { open: false, hasAuthor: true, sending: false, resolution: "submit", ...over },
    t,
  )

describe("the feed's inline composer model", () => {
  it("borrows the full composer's own copy rather than minting a second placeholder", () => {
    expect(model().placeholder).toBe(EN["mode.post.placeholder"])
    expect(model().submitLabel).toBe("Post")
    expect(model({ sending: true }).submitLabel).toBe("Posting...")
  })

  it("opens only once the reader asks for it", () => {
    expect(model().state).toBe("collapsed")
    expect(model({ open: true }).state).toBe("open")
  })

  it("holds Post for an empty draft, for media still uploading, and while one is in flight", () => {
    expect(model({ open: true }).submitDisabled).toBe(false)
    expect(model({ open: true, resolution: "blocked-empty" }).submitDisabled).toBe(true)
    expect(model({ open: true, resolution: "blocked-media-pending" }).submitDisabled).toBe(true)
    expect(model({ open: true, sending: true }).submitDisabled).toBe(true)
    expect(model({ open: true, hasAuthor: false }).submitDisabled).toBe(true)
  })

  it("never posts text the reader is not looking at", () => {
    expect(model({ open: false, resolution: "submit" }).submitDisabled).toBe(true)
  })

  it("claims the shared draft only when it is a plain, unattached post", () => {
    const plain = {
      mode: "post",
      replyToPostId: null,
      quotePostId: null,
      attachedEventId: null,
      attachedReportId: null,
    }
    expect(inlineComposerOwnsDraft(plain)).toBe(true)
    expect(inlineComposerOwnsDraft({ ...plain, mode: "reply" })).toBe(false)
    expect(inlineComposerOwnsDraft({ ...plain, replyToPostId: "post-1" })).toBe(false)
    expect(inlineComposerOwnsDraft({ ...plain, quotePostId: "post-1" })).toBe(false)
    expect(inlineComposerOwnsDraft({ ...plain, attachedEventId: "event-1" })).toBe(false)
    expect(inlineComposerOwnsDraft({ ...plain, attachedReportId: "report-1" })).toBe(false)
  })

  it("collapses on blur only when nothing the reader staged would be lost", () => {
    expect(inlineComposerClosesOnBlur({ body: "   ", mediaCount: 0 })).toBe(true)
    expect(inlineComposerClosesOnBlur({ body: "hello", mediaCount: 0 })).toBe(false)
    expect(inlineComposerClosesOnBlur({ body: "", mediaCount: 1 })).toBe(false)
  })
})

describe("the inline composer rides the full composer's store and submit path", () => {
  const SRC = readFileSync(new URL("../InlineComposer.tsx", import.meta.url), "utf8")
  const FEED = readFileSync(new URL("../../FeedBody.tsx", import.meta.url), "utf8")

  it("resolves the submit through the one shared brain, not a second copy of the rules", () => {
    expect(SRC).toContain('import { resolvePostSubmit } from "../postComposerSubmit"')
    expect(SRC).toContain('from "../postComposerStore"')
    expect(SRC).toContain('import { useCreatePost } from "../../data/hooks/posts"')
    expect(SRC).not.toMatch(/body\.trim\(\)\.length/)
  })

  it("hands a draft it does not own back to the full composer instead of publishing it", () => {
    expect(SRC).toContain("if (!inlineComposerOwnsDraft(draft))")
    expect(SRC).toContain('push({ kind: "composer", ...composerEntryFor(draft) })')
    expect(SRC).toContain("if (!open || !ownsDraft) return")
  })

  it("re-opens a handed-off draft in the mode it was written, not as a new top-level post", () => {
    const reply = {
      mode: "reply",
      replyToPostId: "post-1",
      quotePostId: null,
      attachedEventId: null,
      attachedReportId: null,
    }
    expect(composerEntryFor(reply)).toEqual({ composerMode: "reply", targetPostId: "post-1" })
    expect(
      composerEntryFor({ ...reply, mode: "quote", replyToPostId: null, quotePostId: "post-2" }),
    ).toEqual({ composerMode: "quote", targetPostId: "post-2" })
    expect(composerEntryFor({ ...reply, mode: "post", replyToPostId: null })).toEqual({
      composerMode: "post",
    })
  })

  it("offers the same post-as choice the full composer offers", () => {
    expect(SRC).toContain("AuthorAsChips")
    expect(SRC).toContain("organizationId: postAsOrganizationId")
  })

  it("mirrors staged media into the shared draft ONLY while it is open", () => {
    expect(SRC).toMatch(/if \(!open\) return\s*\n\s*setMedia\(composerMedia\)/)
    expect(SRC).toContain("snapshotCarriedMedia(usePostComposerStore.getState().draft.media)")
  })

  it("is mounted by the feed header, on the expanded shell only", () => {
    expect(FEED).toContain('import { InlineComposer } from "./feed/InlineComposer"')
    expect(FEED).toContain("{headerModel.showInlineComposer ? <InlineComposer /> : null}")
  })

  it("leaves no in-feed events block behind for the header to grow one back from", () => {
    expect(FEED).not.toContain("YourEventsSection")
    expect(FEED).not.toContain("invalidateMyEventInvites")
  })
})
