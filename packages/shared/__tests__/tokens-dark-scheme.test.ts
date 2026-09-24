import { describe, expect, it } from "vitest"
import {
  tokens,
  darkColor,
  darkShadow,
  colorSchemes,
  shadowSchemes,
  categoryColor,
  cleanupColorFor,
} from "../src/tokens/design-tokens.js"
import { contrastRatio, relativeLuminance } from "../src/tokens/chip-contrast.js"

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe("dark color scheme", () => {
  it("mirrors every light color key exactly", () => {
    expect(leafPaths(darkColor).sort()).toEqual(leafPaths(tokens.color).sort())
  })

  it("mirrors every light shadow key exactly", () => {
    expect(leafPaths(darkShadow).sort()).toEqual(leafPaths(tokens.shadow).sort())
  })

  it("keeps every color a 6-digit hex", () => {
    const hexes = leafPaths(darkColor).map((path) =>
      path.split(".").reduce<any>((acc, key) => acc[key], darkColor),
    )
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("exposes both schemes under one lookup", () => {
    expect(colorSchemes.light).toBe(tokens.color)
    expect(colorSchemes.dark).toBe(darkColor)
    expect(shadowSchemes.light).toBe(tokens.shadow)
    expect(shadowSchemes.dark).toBe(darkShadow)
  })

  it("clears WCAG AA body-text contrast on the dark surfaces", () => {
    const { neutral } = darkColor
    for (const surface of [neutral.paper, neutral.paper2, neutral.card, neutral.cardTint]) {
      expect(contrastRatio(neutral.ink, surface)).toBeGreaterThanOrEqual(7)
      expect(contrastRatio(neutral.ink2, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(neutral.ink3, surface)).toBeGreaterThanOrEqual(3)
    }
  })

  it("clears WCAG AA body-text contrast on the LIGHT surfaces (ink3 on paper2 is a known 2.86 exception)", () => {
    const { neutral } = tokens.color
    for (const surface of [neutral.paper, neutral.paper2, neutral.card, neutral.cardTint]) {
      expect(contrastRatio(neutral.ink, surface)).toBeGreaterThanOrEqual(7)
      expect(contrastRatio(neutral.ink2, surface)).toBeGreaterThanOrEqual(4.5)
    }
    for (const surface of [neutral.paper, neutral.card, neutral.cardTint]) {
      expect(contrastRatio(neutral.ink3, surface)).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps the light hairline border visible on the surfaces it divides", () => {
    const { neutral } = tokens.color
    expect(contrastRatio(neutral.ink5, neutral.paper)).toBeGreaterThanOrEqual(1.1)
    expect(contrastRatio(neutral.ink5, neutral.card)).toBeGreaterThanOrEqual(1.25)
  })

  it("keeps the light surface ramp ordered from paper2 up to card", () => {
    const { neutral } = tokens.color
    expect(relativeLuminance(neutral.paper2)).toBeLessThan(relativeLuminance(neutral.paper))
    expect(relativeLuminance(neutral.paper)).toBeLessThan(relativeLuminance(neutral.cardTint))
    expect(relativeLuminance(neutral.cardTint)).toBeLessThan(relativeLuminance(neutral.card))
  })

  it("keeps every category pin distinguishable from the dark paper (3:1 non-text floor)", () => {
    for (const hex of Object.values(darkColor.category)) {
      expect(contrastRatio(hex, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
    }
    expect(contrastRatio(darkColor.cleanup, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(darkColor.brand.bloom, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
  })

  it("keeps the on-accent foreground legible on the accent fill in the dark scheme", () => {
    expect(contrastRatio(darkColor.neutral.paper, darkColor.brand.bloom)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(darkColor.neutral.paper, darkColor.brand.moss)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(darkColor.neutral.paper, darkColor.brand.sun)).toBeGreaterThanOrEqual(4.5)
    for (const hex of Object.values(darkColor.category)) {
      expect(contrastRatio(darkColor.neutral.paper, hex)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps the accent text legible on every dark surface", () => {
    const { neutral } = darkColor
    for (const surface of [neutral.paper, neutral.paper2, neutral.card, neutral.cardTint]) {
      expect(contrastRatio(darkColor.bloom["600"], surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps every category pin distinguishable from the dark card surfaces (3:1 non-text floor)", () => {
    for (const surface of [darkColor.neutral.card, darkColor.neutral.cardTint]) {
      for (const hex of Object.values(darkColor.category)) {
        expect(contrastRatio(hex, surface)).toBeGreaterThanOrEqual(3)
      }
      expect(contrastRatio(darkColor.cleanup, surface)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(darkColor.brand.bloom, surface)).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps the light scheme the default for the category helpers", () => {
    expect(categoryColor("hazard")).toBe(tokens.color.category.hazard)
    expect(categoryColor("hazard", "light")).toBe(tokens.color.category.hazard)
    expect(categoryColor("hazard", "dark")).toBe(darkColor.category.hazard)
    expect(categoryColor("nope", "dark")).toBe(darkColor.category.other)
    expect(cleanupColorFor("light")).toBe(tokens.color.cleanup)
    expect(cleanupColorFor("dark")).toBe(darkColor.cleanup)
  })
})
