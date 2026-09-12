import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const body = readFileSync(new URL("../../PostThreadBody.tsx", import.meta.url), "utf8")
const focal = readFileSync(new URL("../ThreadFocalPost.tsx", import.meta.url), "utf8")
const replyRow = readFileSync(new URL("../ThreadReplyRow.tsx", import.meta.url), "utf8")

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
    for (const src of [focal, replyRow]) {
      expect(src).toMatch(/const openEntry = onOpenEntry \?\? push/)
      expect(src.match(/\bpush\(\{/g)).toBeNull()
    }
  })

  it("covers every entry kind the thread surface can open", () => {
    const surface = body + focal + replyRow
    for (const kind of ["person", "cleanup", "pin", "post-thread", "composer"]) {
      expect(surface).toMatch(new RegExp(`openEntry\\(\\{ kind: "${kind}"`))
    }
  })
})
