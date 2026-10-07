import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const body = readFileSync(new URL("../../PostThreadBody.tsx", import.meta.url), "utf8")
const focal = readFileSync(new URL("../ThreadFocalPost.tsx", import.meta.url), "utf8")
const replyRow = readFileSync(new URL("../ThreadReplyRow.tsx", import.meta.url), "utf8")
const rowActions = readFileSync(new URL("../../postCardActions.ts", import.meta.url), "utf8")

describe("post-thread navigation seam: every push-capable tap routes through onOpenEntry", () => {
  it("PostThreadBody exposes the seam and hands it to every row it renders", () => {
    expect(body).toMatch(/onOpenEntry\?: \(entry: DetailEntry\) => void/)
    expect(body).toMatch(/<ThreadFocalPost[\s\S]*?onOpenEntry=\{onOpenEntry\}/)
    expect(body).toMatch(/<ThreadReplyRow[\s\S]*?onOpenEntry=\{onOpenEntry\}/)
  })

  it("PostThreadBody never bypasses the seam with a bare store push", () => {
    expect(body.match(/\bpush\(\{/g)).toBeNull()
  })

  /**
   * The flat thread's whole navigation model: a reply row IS the way into that reply's own thread, so the
   * row press and the comment glyph both route one entry through the seam.
   */
  it("a reply row opens its own thread through the seam, from the row and the comment glyph", () => {
    expect(replyRow).toMatch(/openEntry\(\{ kind: "post-thread", id: post\.id \}\)/)
    expect(replyRow).toMatch(/onPress=\{openThread\}/)
    expect(replyRow).toMatch(/onComment=\{openThread\}/)
  })

  it("ThreadFocalPost and ThreadReplyRow fall back to the push only when the seam is absent", () => {
    expect(rowActions).toMatch(/const openEntry = onOpenEntry \?\? push/)
    for (const src of [focal, replyRow, rowActions]) {
      expect(src.match(/\bpush\(\{/g)).toBeNull()
    }
    for (const src of [focal, replyRow]) {
      expect(src).toMatch(/\{ openEntry, openPerson,[^}]*\}\s*=\s*usePostRowActions\(\{ post, identity, onOpenEntry \}\)/)
      expect(src).not.toMatch(/useNavStore/)
    }
  })

  it("routes both thread menus' navigation through the seam", () => {
    for (const src of [focal, replyRow]) {
      expect(src).toMatch(/<PostOverflowMenu[\s\S]*?onOpenPerson=\{openPerson\}/)
    }
    expect(rowActions).toMatch(
      /const openPerson = React\.useCallback\(\s*\(personId: string\) => openEntry\(\{ kind: "person", id: personId \}\)/,
    )
    expect(focal).toContain('openEntry({ kind: "post-thread", id: embedded.id })')
    expect(focal).toContain("isRepost && embedded && !embedded.deleted")
    expect(focal).toMatch(/<PostOverflowMenu[\s\S]*?onOpenOriginal=\{openOriginal\}/)
  })

  it("covers every entry kind the thread surface can open", () => {
    const surface = body + focal + replyRow + rowActions
    for (const kind of ["person", "cleanup", "pin", "post-thread", "composer"]) {
      expect(surface).toMatch(new RegExp(`openEntry\\(\\{ kind: "${kind}"`))
    }
  })
})
