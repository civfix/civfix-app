import { describe, it, expect } from "vitest"
import { tokens, categoryColor, cleanupColor, color } from "../src/tokens/design-tokens.js"
import { ReportCategorySchema } from "../src/schemas/common.js"

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

  it("space and radius scales carry numeric values", () => {
    expect(tokens.space["4"]).toBe(16)
    expect(tokens.radius.pill).toBe(999)
    expect(tokens.radius.pin).toBe("50% 50% 50% 6px")
  })
})
