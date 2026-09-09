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

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  )
}

function rgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "")
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
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
      expect(contrast(neutral.ink, surface)).toBeGreaterThanOrEqual(7)
      expect(contrast(neutral.ink2, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(neutral.ink3, surface)).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps every category pin distinguishable from the dark paper (3:1 non-text floor)", () => {
    for (const hex of Object.values(darkColor.category)) {
      expect(contrast(hex, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
    }
    expect(contrast(darkColor.cleanup, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
    expect(contrast(darkColor.brand.bloom, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
  })

  it("keeps the on-accent foreground legible on the accent fill in the dark scheme", () => {
    expect(contrast(darkColor.neutral.paper, darkColor.brand.bloom)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(darkColor.neutral.paper, darkColor.brand.moss)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(darkColor.neutral.paper, darkColor.brand.sun)).toBeGreaterThanOrEqual(4.5)
    for (const hex of Object.values(darkColor.category)) {
      expect(contrast(darkColor.neutral.paper, hex)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps the accent text legible on every dark surface", () => {
    const { neutral } = darkColor
    for (const surface of [neutral.paper, neutral.paper2, neutral.card, neutral.cardTint]) {
      expect(contrast(darkColor.bloom["600"], surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps every category pin distinguishable from the dark card surfaces (3:1 non-text floor)", () => {
    for (const surface of [darkColor.neutral.card, darkColor.neutral.cardTint]) {
      for (const hex of Object.values(darkColor.category)) {
        expect(contrast(hex, surface)).toBeGreaterThanOrEqual(3)
      }
      expect(contrast(darkColor.cleanup, surface)).toBeGreaterThanOrEqual(3)
      expect(contrast(darkColor.brand.bloom, surface)).toBeGreaterThanOrEqual(3)
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
