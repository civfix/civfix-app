import { describe, expect, it } from "vitest"
import { tokens } from "@civfix/shared/tokens"
import { alpha } from "../alpha"

describe("alpha()", () => {
  it("expands a 6-digit hex into an rgba string", () => {
    expect(alpha("#F0685C", 0.32)).toBe("rgba(240, 104, 92, 0.32)")
  })

  it("accepts a hex without the leading hash", () => {
    expect(alpha("F0685C", 0.5)).toBe("rgba(240, 104, 92, 0.5)")
  })

  it("expands a 3-digit shorthand hex", () => {
    expect(alpha("#fff", 0)).toBe("rgba(255, 255, 255, 0)")
  })

  it("clamps the amount into 0..1", () => {
    expect(alpha("#000000", -1)).toBe("rgba(0, 0, 0, 0)")
    expect(alpha("#000000", 4)).toBe("rgba(0, 0, 0, 1)")
  })

  it("falls back to fully opaque rather than emitting rgba(..., NaN)", () => {
    expect(alpha("#000000", Number.NaN)).toBe("rgba(0, 0, 0, 1)")
    expect(alpha("#000000", Number.POSITIVE_INFINITY)).toBe("rgba(0, 0, 0, 1)")
  })

  it("returns the input untouched when it is not a hex color", () => {
    expect(alpha("rgba(26,23,20,0.45)", 0.2)).toBe("rgba(26,23,20,0.45)")
    expect(alpha("#12345", 0.2)).toBe("#12345")
  })

  it("renders the brand coral at the border alpha the cards use", () => {
    expect(alpha(tokens.color.brand.bloom, 0.32)).toBe("rgba(240, 104, 92, 0.32)")
  })

  it("matches the transparent-to-opaque pair a scroll fade needs", () => {
    const bg = tokens.color.neutral.paper
    expect(alpha(bg, 0)).toMatch(/^rgba\(\d+, \d+, \d+, 0\)$/)
    expect(alpha(bg, 1)).toMatch(/^rgba\(\d+, \d+, \d+, 1\)$/)
  })
})
