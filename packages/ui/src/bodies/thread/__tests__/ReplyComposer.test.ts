import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Source-text guards for two composer properties the package's other checks cannot see: it ships no React
 * renderer, so typecheck, lint and threadModel.test.ts are all blind to them.
 *
 * 1. ONE COMPOSER PER THREAD. The composer replies to the focal post and nothing else - replying to a reply
 *    means opening that reply's own thread. Its staged media lives in component state (`carried` +
 *    `useComposerAttachments`) while the draft is keyed by the target id, so if the focal post could change
 *    under a MOUNTED instance the two would disagree and the previous post's photos would ride along into
 *    the new parent's draft. The web shell can reuse this screen's instance across entries, so the screen
 *    remounts on `id` instead of reconciling - that key IS the invariant.
 * 2. THE ATTACHED-REPORT CHIP IS DERIVED, NOT CACHED. An earlier write-only `attachedReport` useState, with
 *    no repopulation path, left the generic "Attach a report" label showing forever after leaving a thread
 *    and coming back, while `draft.attachedReportId` (the submitted data) was intact.
 */
const composer = readFileSync(new URL("../ReplyComposer.tsx", import.meta.url), "utf8")
const body = readFileSync(new URL("../../PostThreadBody.tsx", import.meta.url), "utf8")

describe("one composer per thread", () => {
  it("remounts the screen when the focal post changes, so no composer state rides along", () => {
    const wrapper = body.slice(
      body.indexOf("export function PostThreadBody"),
      body.indexOf("function PostThread({"),
    )
    expect(wrapper).toContain("key={props.id}")
    expect(wrapper, "the exported wrapper must stay hook-free, or the key stops remounting state")
      .not.toMatch(/\buse[A-Z]/)
  })

  it("aims the composer at the focal post and nothing else", () => {
    expect(composer).not.toContain("replyTarget")
    expect(composer).not.toContain("onClearTarget")
    expect(composer).toContain("const targetId = focalPost.id")
  })
})

describe("attached-report chip", () => {
  it("derives the chip from the draft instead of caching it as write-only state", () => {
    expect(composer).toContain("useReport(draft.attachedReportId")
    expect(composer).not.toContain("setAttachedReport(")
  })
})
