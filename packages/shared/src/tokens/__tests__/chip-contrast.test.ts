import { describe, expect, it } from "vitest"
import { colorSchemes, darkColor, tokens, type ColorSchemeName } from "../design-tokens.js"
import {
  CHIP_HUE_NAMES,
  MIN_CHIP_RATIO,
  chipHuePairs,
  chipPairPasses,
  contrastRatio,
  mixWithWhite,
  relativeLuminance,
} from "../chip-contrast.js"

const SCHEMES: ColorSchemeName[] = ["light", "dark"]

describe("contrast math", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10)
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10)
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 10)
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 10)
  })

  it("is symmetric", () => {
    expect(contrastRatio("#356291", "#E9F1FA")).toBeCloseTo(contrastRatio("#E9F1FA", "#356291"), 12)
  })

  it("mixes toward white and clamps the weight", () => {
    expect(mixWithWhite("#000000", 1)).toBe("#000000")
    expect(mixWithWhite("#000000", 0)).toBe("#FFFFFF")
    expect(mixWithWhite("#000000", 0.5)).toBe("#808080")
    expect(mixWithWhite("#000000", 5)).toBe("#000000")
    expect(mixWithWhite("#000000", -5)).toBe("#FFFFFF")
  })

  it("refuses a malformed hex instead of silently scoring garbage", () => {
    expect(() => relativeLuminance("#FFF")).toThrow(RangeError)
    expect(() => contrastRatio("nope", "#FFFFFF")).toThrow(RangeError)
  })
})

describe("chipHuePairs", () => {
  it("derives every hue pair from the live token palette", () => {
    for (const scheme of SCHEMES) {
      const pairs = chipHuePairs(scheme)
      expect(pairs.map((pair) => pair.name)).toEqual([...CHIP_HUE_NAMES])
      for (const pair of pairs) {
        expect(pair.text).toBe(colorSchemes[scheme].chipInk[pair.name])
        expect(pair.bg).toBe(colorSchemes[scheme][pair.name]["50"])
        expect(pair.minRatio).toBe(MIN_CHIP_RATIO)
      }
    }
  })

  it("clears AA (4.5:1) for every chip hue in both schemes", () => {
    expect(MIN_CHIP_RATIO).toBe(4.5)
    for (const scheme of SCHEMES) {
      for (const pair of chipHuePairs(scheme)) {
        const ratio = contrastRatio(pair.text, pair.bg)
        expect(
          ratio,
          `${scheme} ${pair.name} chip ink ${pair.text} on ${pair.bg} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MIN_CHIP_RATIO)
        expect(chipPairPasses(pair)).toBe(true)
      }
    }
  })

  it("keeps chip ink legible on the card surface too", () => {
    for (const scheme of SCHEMES) {
      const palette = colorSchemes[scheme]
      for (const hue of CHIP_HUE_NAMES) {
        expect(contrastRatio(palette.chipInk[hue], palette.neutral.card)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe("new 700 ramp steps", () => {
  it("adds sun.700 and lilac.700 to both schemes without moving the existing steps", () => {
    expect(tokens.color.sun["700"]).toBe("#81610E")
    expect(tokens.color.lilac["700"]).toBe("#7457B6")
    expect(darkColor.sun["700"]).toBe("#F5D480")
    expect(darkColor.lilac["700"]).toBe("#D5C7F1")
    expect(tokens.color.sun["600"]).toBe("#B98A14")
    expect(tokens.color.lilac["600"]).toBe("#7A5CC0")
    expect(tokens.color.bloom["700"]).toBe("#C74537")
    expect(tokens.color.moss["700"]).toBe("#2F7D46")
    expect(tokens.color.sky["700"]).toBe("#356291")
  })

  it("keeps every new hex uppercase 6-digit so the dark-scheme mirror test still holds", () => {
    for (const scheme of SCHEMES) {
      for (const hex of Object.values(colorSchemes[scheme].chipInk)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/)
      }
    }
  })
})
