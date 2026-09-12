import { describe, it, expect } from "vitest"
import {
  tokens,
  categoryColor,
  cleanupColor,
  color,
  colorSchemes,
  type ColorSchemeName,
} from "../src/tokens/design-tokens.js"
import { contrastRatio } from "../src/tokens/chip-contrast.js"
import { ReportCategorySchema } from "../src/schemas/common.js"

const SCHEMES: readonly ColorSchemeName[] = ["light", "dark"]

describe("design tokens", () => {
  it("exposes the approved brand colors", () => {
    expect(tokens.color.brand.bloom).toBe("#F0685C")
    expect(tokens.color.brand.moss).toBe("#63A45A")
    expect(tokens.color.brand.sun).toBe("#D9A21B")
  })

  it("uses Hanken Grotesk for body text", () => {
    expect(tokens.font.body).toBe("Hanken Grotesk")
  })

  it("categoryColor resolves known categories", () => {
    expect(categoryColor("graffiti")).toBe("#9B7ED9")
    expect(categoryColor("trash")).toBe("#776C60")
    expect(categoryColor("water")).toBe("#74A9D8")
  })

  it("categoryColor falls back to 'other' for unknown input", () => {
    expect(categoryColor("not-a-category")).toBe(tokens.color.category.other)
  })

  it("has a color bucket for every canonical report category", () => {
    for (const cat of ReportCategorySchema.options) {
      expect(typeof categoryColor(cat)).toBe("string")
      expect(categoryColor(cat)).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it("cleanup color is the event gold accent", () => {
    expect(cleanupColor).toBe("#D9A21B")
    expect(color.cleanup).toBe("#D9A21B")
  })

  it("keeps danger off the brand hue so red means it destroys something", () => {
    expect(tokens.color.semantic.dangerInk).not.toBe(tokens.color.brand.bloom)
    expect(tokens.color.semantic.dangerInk).not.toBe(tokens.color.bloom["700"])
    expect(color.semantic.chartInk).toBe(tokens.color.moss["600"])
  })

  it.each(SCHEMES)("clears the danger contrast floors in the %s scheme", (scheme) => {
    const { semantic, neutral } = colorSchemes[scheme]
    expect(contrastRatio(semantic.dangerInk, neutral.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(semantic.dangerInk, neutral.paper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(semantic.onDanger, semantic.dangerFill)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SCHEMES)("clears the selection and success floors in the %s scheme", (scheme) => {
    const { semantic, neutral } = colorSchemes[scheme]
    expect(contrastRatio(semantic.selectedInk, semantic.selectedFill)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(semantic.successInk, neutral.card)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SCHEMES)("keeps the chart ink at the 3:1 non-text floor in the %s scheme", (scheme) => {
    const { semantic, neutral } = colorSchemes[scheme]
    for (const surface of [neutral.card, neutral.cardTint, neutral.paper, neutral.paper2]) {
      expect(contrastRatio(semantic.chartInk, surface)).toBeGreaterThanOrEqual(3)
    }
    expect(contrastRatio(semantic.chartInk, semantic.chartTrack)).toBeGreaterThanOrEqual(3)
  })

  it.each(SCHEMES)("puts a legible neutral on the coral CTA in the %s scheme", (scheme) => {
    const { neutral, brand } = colorSchemes[scheme]
    const onCta = scheme === "light" ? neutral.ink : neutral.paper
    expect(contrastRatio(onCta, brand.bloom)).toBeGreaterThanOrEqual(4.5)
  })

  it("space and radius scales carry numeric values", () => {
    expect(tokens.space["4"]).toBe(16)
    expect(tokens.radius.pill).toBe(999)
    expect(tokens.radius.pin).toBe("50% 50% 50% 6px")
  })
})
