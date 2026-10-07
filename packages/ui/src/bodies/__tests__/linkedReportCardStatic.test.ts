import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const card = readFileSync(new URL("../LinkedReportCard.tsx", import.meta.url), "utf8")

describe("a LinkedReportCard with nothing to press", () => {
  it("renders the card as a plain View, not a disabled button", () => {
    expect(card).toMatch(/const card =\s*onPress \|\| selectable \? \(\s*<Pressable/)
    const staticBranch = /\) : \(\s*<View style=\{\[styles\.card[\s\S]*?<\/View>\s*\)/.exec(card)?.[0] ?? ""
    expect(staticBranch).toContain("{content}")
    expect(staticBranch).not.toContain("accessibilityRole")
    expect(staticBranch).not.toContain("accessibilityLabel")
  })
})
