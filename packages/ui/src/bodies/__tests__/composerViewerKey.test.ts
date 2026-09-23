import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Source-text guards (the package ships no renderer). The composers mirror their draft into component
 * state (`carriedMedia`, `useComposerAttachments`) and write it back to the store on change, so a mounted
 * composer that survives an account switch or a sign-out would put the previous author's photos into the
 * next owner's draft. Each composer therefore remounts when its draft changes hands.
 */
const postComposer = readFileSync(new URL("../PostComposer.tsx", import.meta.url), "utf8")
const inlineComposer = readFileSync(new URL("../feed/InlineComposer.tsx", import.meta.url), "utf8")
const threadBody = readFileSync(new URL("../PostThreadBody.tsx", import.meta.url), "utf8")

function exportedFunction(src: string, name: string): string {
  const start = src.indexOf(`export function ${name}(`)
  expect(start, `${name} is not exported as a function`).toBeGreaterThan(-1)
  return src.slice(start, src.indexOf("\n}\n", start))
}

describe("composers remount when their draft changes hands", () => {
  it("keys the full-screen composer on the draft owner", () => {
    const outer = exportedFunction(postComposer, "PostComposer")
    expect(outer).toContain("usePostComposerStore(selectPostComposerDraftOwner)")
    expect(outer).toMatch(/key=\{draftOwner \?\? ""\}/)
  })

  it("keys the feed's inline composer on the draft owner", () => {
    const outer = exportedFunction(inlineComposer, "InlineComposer")
    expect(outer).toContain("usePostComposerStore(selectPostComposerDraftOwner)")
    expect(outer).toMatch(/key=\{draftOwner \?\? ""\}/)
  })

  it("keys the thread's reply composer on the draft generation", () => {
    expect(threadBody).toContain("useViewerDraftGeneration()")
    const start = threadBody.indexOf("<ReplyComposer\n")
    expect(start).toBeGreaterThan(-1)
    const mount = threadBody.slice(start, threadBody.indexOf("/>", start))
    expect(mount).toContain("key={draftGeneration}")
  })
})

describe("a hidden draft is read-only, never a sink for dropped keystrokes", () => {
  it("disables the body input, the media picker and submit while the author's draft is hidden", () => {
    expect(postComposer).toContain("usePostComposerStore(selectPostComposerDraftHidden)")
    expect(postComposer).toContain("editable={!draftHidden}")
    expect(postComposer).toMatch(/const canAttachMedia = postComposerCanAttach\(\{\s*hookCanAttach: !draftHidden &&/)
    expect(postComposer).toMatch(/const submitDisabled =\s*draftHidden \|\|/)
  })

  it("mirrors attachments that finished while hidden once the author is back", () => {
    expect(postComposer).toMatch(/if \(!draftHidden\) setMedia\(composerMedia\)\s*\}, \[composerMedia, draftHidden, setMedia\]\)/)
  })
})
