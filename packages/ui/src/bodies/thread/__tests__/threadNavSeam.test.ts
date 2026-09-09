import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const body = readFileSync(new URL("../../PostThreadBody.tsx", import.meta.url), "utf8")
const focal = readFileSync(new URL("../ThreadFocalPost.tsx", import.meta.url), "utf8")
const replyRow = readFileSync(new URL("../ThreadReplyRow.tsx", import.meta.url), "utf8")

describe("post-thread navigation seam: every push-capable tap routes through onOpenEntry", () => {
  it("PostThreadBody exposes the seam and defaults it to the store push", () => {
    expect(body).toMatch(/onOpenEntry\?: \(entry: DetailEntry\) => void/)
    expect(body).toMatch(/if \(onOpenEntry\) onOpenEntry\(entry\)\s*\n\s*else push\(entry\)/)
  })

  it("PostThreadBody never bypasses the seam with a bare store push", () => {
    expect(body.match(/\bpush\(\{/g)).toBeNull()
    expect(body).toMatch(/openEntry\(\{ kind: "post-thread", id: postId \}\)/)
    expect(body).toMatch(/openEntry\(\{ kind: "post-thread", id: listRow\.parentId \}\)/)
  })

  it("PostThreadBody threads the seam into the focal post and every reply row", () => {
    expect(body).toMatch(/<ThreadFocalPost[\s\S]*?onOpenEntry=\{onOpenEntry\}/)
    expect(body).toMatch(/<ThreadReplyRow[\s\S]*?onOpenEntry=\{onOpenEntry\}/)
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
