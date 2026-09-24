import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import {
  buildInlineComposerModel,
  composerEntryFor,
  inlineComposerClosesOnBlur,
  inlineComposerFocusWithin,
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
    const blur = (over: Partial<Parameters<typeof inlineComposerClosesOnBlur>[0]>) =>
      inlineComposerClosesOnBlur({ body: "", mediaCount: 0, focusWithin: false, ...over })
    expect(blur({ body: "   " })).toBe(true)
    expect(blur({ body: "hello" })).toBe(false)
    expect(blur({ mediaCount: 1 })).toBe(false)
  })

  it("stays open whenever the interaction never left the composer card", () => {
    expect(inlineComposerClosesOnBlur({ body: "", mediaCount: 0, focusWithin: true })).toBe(false)
  })
})

describe("the inline composer decides on blur by where the focus LANDED", () => {
  const addMediaButton = { name: "add a photo or video" }
  const outside = { name: "a link further down the feed" }
  const card = { contains: (node: unknown) => node === addMediaButton }

  const blurTo = (
    next: unknown,
    over: { body?: string; mediaCount?: number; pressingOwnControl?: boolean } = {},
  ) =>
    inlineComposerClosesOnBlur({
      body: over.body ?? "",
      mediaCount: over.mediaCount ?? 0,
      focusWithin: inlineComposerFocusWithin({
        card,
        next,
        pressingOwnControl: over.pressingOwnControl ?? false,
      }),
    })

  it("survives a Tab from the empty input onto its own add-media button", () => {
    expect(blurTo(addMediaButton)).toBe(false)
  })

  it("survives a click that moves focus onto its own add-media button", () => {
    expect(blurTo(addMediaButton)).toBe(false)
  })

  it("survives a press on its own control in a browser that focuses no button on click", () => {
    expect(blurTo(null, { pressingOwnControl: true })).toBe(false)
  })

  it("collapses when an empty draft's focus leaves the card", () => {
    expect(blurTo(outside)).toBe(true)
    expect(blurTo(null)).toBe(true)
  })

  it("keeps a started draft alive when focus leaves the card", () => {
    expect(blurTo(outside, { body: "hello" })).toBe(false)
    expect(blurTo(outside, { mediaCount: 1 })).toBe(false)
  })

  it("treats a card it cannot measure yet as focus gone, not as focus held", () => {
    const within = (card: Parameters<typeof inlineComposerFocusWithin>[0]["card"]) =>
      inlineComposerFocusWithin({ card, next: addMediaButton, pressingOwnControl: false })
    expect(within(null)).toBe(false)
    expect(within({})).toBe(false)
  })
})

describe("the inline composer rides the full composer's store and submit path", () => {
  const SRC = readFileSync(new URL("../InlineComposer.tsx", import.meta.url), "utf8")
  const FEED = readFileSync(new URL("../../FeedBody.tsx", import.meta.url), "utf8")

  it("resolves the submit through the one shared brain, not a second copy of the rules", () => {
    expect(SRC).toMatch(/import \{[^}]*\bresolvePostSubmit\b[^}]*\} from "\.\.\/postComposerSubmit"/)
    expect(SRC).toContain('from "../postComposerStore"')
    expect(SRC).toContain('import { useSubmitPost } from "../postComposer/useSubmitPost"')
    expect(readFileSync(new URL("../../postComposer/useSubmitPost.ts", import.meta.url), "utf8")).toContain(
      'import { useCreatePost } from "../../data/hooks/posts"',
    )
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
    expect(SRC).toContain("const draft = selectPostComposerDraft(usePostComposerStore.getState())")
    expect(SRC).toContain("snapshotCarriedMedia(draft.media)")
  })

  it("asks the DOM where focus went before it collapses, so its own controls stay mounted", () => {
    expect(SRC).toContain("<View ref={cardRef} style={styles.card}>")
    expect(SRC).toContain("relatedTarget")
    expect(SRC).toContain("document.activeElement")
    expect(SRC).toContain("deferredBlurRef.current = setTimeout(() => {")
    expect(SRC).toContain("inlineComposerFocusWithin({")
    expect(SRC).toMatch(
      /inlineComposerClosesOnBlur\(\{ body, mediaCount: composerMedia\.length, focusWithin \}\)/,
    )
  })

  it("lets go of the press flag when the press ends, so a later tap outside still collapses it", () => {
    expect(SRC).toContain("onPressIn={holdOwnControl}")
    expect(SRC).toContain("onPressOut={releaseOwnControl}")
    expect(SRC).toMatch(
      /const releaseOwnControl = useCallback\(\(\) => \{\n\s*pressingOwnControlRef\.current = false/,
    )
    expect(SRC).not.toContain("holdOpenForOwnControl")
  })

  it("draws its own focus treatment instead of the browser's ring", () => {
    expect(SRC).toContain("style={[webInputReset, styles.input]}")
    expect(SRC).toContain("bodyFocused ? styles.inputSurfaceFocused : null")
    expect(SRC).toContain("onFocus={onFocus}")
  })

  it("keeps the idle card down to the avatar and the prompt, with no dead Post button", () => {
    const start = SRC.indexOf('if (model.state === "collapsed")')
    const end = SRC.indexOf("<View ref={cardRef} style={styles.card}>")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const collapsed = SRC.slice(start, end)
    expect(collapsed).toContain("{avatar}")
    expect(collapsed).not.toContain("{postButton}")
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
