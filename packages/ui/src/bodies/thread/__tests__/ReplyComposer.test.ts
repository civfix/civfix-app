import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../../__tests__/sourceGuards"

/**
 * Source-text guards for composer properties the package's other checks cannot see: it ships no React
 * renderer, so typecheck, lint and threadModel.test.ts are all blind to them.
 *
 * 1. ONE COMPOSER PER THREAD. The composer replies to the focal post and nothing else - replying to a reply
 *    means opening that reply's own thread. Its staged media lives in component state (`carried` +
 *    `useComposerAttachments`) while the draft is keyed by the target id, so if the focal post could change
 *    under a MOUNTED instance the two would disagree and the previous post's photos would ride along into
 *    the new parent's draft. The web shell can reuse this screen's instance across entries, so the screen
 *    remounts on `id` instead of reconciling - that key IS the invariant.
 * 2. THE POSTED REPLY RELEASES THE FIELD. If `onSuccess` re-focused the input, `focused` would stay true,
 *    `replyComposerState` would stay "expanded", and the "Replying to @X" chip plus the soft keyboard would
 *    both outlive the reply that was already sent.
 * 3. THE ATTACHED-REPORT CHIP IS DERIVED, NOT CACHED. A write-only `attachedReport` state has no
 *    repopulation path, so it would show the generic "Attach a report" label forever after leaving a thread
 *    and coming back, while `draft.attachedReportId` (the submitted data) was intact.
 */
const composer = readFileSync(new URL("../ReplyComposer.tsx", import.meta.url), "utf8")
const body = readFileSync(new URL("../../PostThreadBody.tsx", import.meta.url), "utf8")

describe("one composer per thread", () => {
  it("remounts the screen when the focal post changes, so no composer state rides along", () => {
    const wrapper = sliceBetween(body, "export function PostThreadBody", "function PostThread({")
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

describe("a posted reply", () => {
  const success = sliceBetween(composer, "onSuccess: (post) => {", "onSettled:")

  it("releases the field instead of re-focusing it, so the chip and the keyboard both go", () => {
    expect(success).toContain("grow.ref.current?.blur()")
    expect(success).toContain("Keyboard.dismiss()")
    expect(success).not.toContain("grow.ref.current?.focus()")
    expect(composer).not.toContain("Keep the keyboard up")
  })

  it("closes an open attach sheet and scrolls the thread before the dock inset drops", () => {
    expect(success).toContain("setAttachOpen(false)")
    expect(success.indexOf("grow.ref.current?.blur()")).toBeGreaterThan(
      success.indexOf("onPosted?.(post)"),
    )
  })

  it("takes the release from the shared rule rather than an inline decision", () => {
    expect(composer).toContain('const REPLY_FOCUS_AFTER_SEND = composerFocusAfterSend("thread-reply")')
    expect(success).toContain('if (REPLY_FOCUS_AFTER_SEND === "release") {')
  })
})

describe("attached-report chip", () => {
  it("derives the chip from the draft instead of caching it as write-only state", () => {
    expect(composer).toContain("useReport(draft.attachedReportId")
    expect(composer).not.toContain("setAttachedReport(")
  })
})

describe("the reply attach sheet on iOS (APP-BUG-143)", () => {
  const sheet = readFileSync(new URL("../ReplyAttachSheet.tsx", import.meta.url), "utf8")
  const sheetShell = sliceBetween(sheet, "export function ReplyAttachSheet(", "function PickerHeader(")

  it("stays mounted when it closes, so RN Modal can fire the onDismiss that runs Photo and Camera", () => {
    expect(composer).not.toMatch(/\{attachOpen \? \(\s*<ReplyAttachSheet/)
    expect(composer).toMatch(/<ReplyAttachSheet\s+visible=\{attachOpen\}/)
    expect(sheetShell).toContain("onDismiss={onModalDismiss}")
  })

  it("keeps the candidate queries out of the always-mounted shell", () => {
    expect(sheetShell).not.toContain("useAttendingCleanups(")
    expect(sheetShell).not.toContain("useMyReports(")
    expect(sheet.slice(sheet.indexOf("function EventsPicker("))).toContain("useAttendingCleanups()")
    expect(sheet.slice(sheet.indexOf("function ReportsPicker("))).toContain("useMyReports()")
  })
})
