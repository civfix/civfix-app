import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const badge = strip(read("../VerifiedBadge.tsx"))

describe("VerifiedBadge is a solid seal, not an outline", () => {
  it("fills the seal with the brand sky, and lets a caller override that fill", () => {
    expect(badge).toContain("fill={color ?? th.colors.brand.sky}")
  })

  it("no longer spends the badge colour on the stroke, which is what made it an outline", () => {
    expect(badge).not.toContain("color={color ?? th.colors.brand.sky}")
  })

  it("strokes the check in the on-accent ink, the same token the map pins use over a brand fill", () => {
    expect(badge).toContain("color={th.colors.onAccent}")
  })

  it("keeps the glyph weight and both sizes", () => {
    expect(badge).toContain("strokeWidth={2.25}")
    expect(badge).toContain("const SIZES: Record<VerifiedBadgeSize, number> = { sm: 14, md: 18 }")
    expect(badge).toContain("size={glyph}")
  })

  it("keeps the accessible wrapper, so the seal still announces itself", () => {
    expect(badge).toContain('accessibilityRole="image"')
    expect(badge).toContain('accessibilityLabel={label ?? t("verified_badge")}')
  })

  it("hardcodes no colour", () => {
    expect(badge).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(badge).not.toMatch(/\brgba?\(/)
  })
})
