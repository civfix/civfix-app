import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const adapter = read("./use-web-nav-adapter.ts")
const preview = read("../dev/landscape-preview.tsx")

describe("the mount seed takes its layout mode from the shared shell rule", () => {
  it("seeds the nav store through layoutModeFor, not a local orientation test", () => {
    expect(adapter).toContain("layoutModeFor,")
    expect(adapter).toContain("return layoutModeFor(window.innerWidth, window.innerHeight)")
    expect(adapter).toContain("seed(entryFromPath(pathname), liveMode())")
    expect(adapter).not.toContain("window.innerWidth >= window.innerHeight")
  })

  it("keeps the /landscape harness on the same rule, so the two never disagree", () => {
    expect(preview).toContain('import { layoutModeFor } from "@civfix/ui"')
    expect(preview).toContain("return layoutModeFor(window.innerWidth, window.innerHeight)")
    expect(preview).not.toContain("window.innerWidth >= window.innerHeight")
  })
})
