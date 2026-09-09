import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("../SegmentedCodeInput.tsx", import.meta.url), "utf8")
const barrel = readFileSync(new URL("../index.ts", import.meta.url), "utf8")

describe("SegmentedCodeInput focus handle", () => {
  it("exposes an imperative focus() so a host can refocus after a failed verify", () => {
    expect(source).toContain("export interface SegmentedCodeInputHandle")
    expect(source).toMatch(/useImperativeHandle\(ref, \(\) => \(\{ focus \}\), \[focus\]\)/)
  })

  it("takes ref as a prop (React 19) rather than reintroducing forwardRef", () => {
    expect(source).toMatch(/ref\?: React\.Ref<SegmentedCodeInputHandle>/)
    expect(source).not.toContain("forwardRef")
  })

  it("publishes the handle type so hosts can type their ref", () => {
    expect(barrel).toContain("SegmentedCodeInputHandle")
  })

  it("keeps one focus closure shared by the press target and the handle", () => {
    expect(source).toMatch(/const focus = useCallback\(\(\) => inputRef\.current\?\.focus\(\), \[\]\)/)
    expect(source.match(/inputRef\.current\?\.focus\(\)/g)).toHaveLength(1)
  })
})
