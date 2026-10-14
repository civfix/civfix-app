import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  categoryColor,
  cleanupColorFor,
  colorSchemes,
  type ColorSchemeName,
} from "@civfix/shared/tokens"
import { contrastRatio } from "@civfix/shared/chip-contrast"
import { makeThemeColors } from "../../theme/schemes"
import { basemapPaper } from "../mapStyle"
import { PIN_NON_TEXT_CONTRAST, inkOnFill, pinOutlineFor } from "../pins/appearance"

const SCHEMES: ColorSchemeName[] = ["light", "dark"]

function pinFills(scheme: ColorSchemeName): Record<string, string> {
  const { brand, category } = colorSchemes[scheme]
  return {
    ...Object.fromEntries(Object.keys(category).map((key) => [key, categoryColor(key, scheme)])),
    cleanup: cleanupColorFor(scheme),
    bloom: brand.bloom,
    lilac: brand.lilac,
  }
}

describe("every pin body reads against the basemap (WCAG 1.4.11, 3:1)", () => {
  it("light: each fill, or the outline drawn around it, clears basemapPaper('light')", () => {
    const ground = basemapPaper("light")
    const outline = pinOutlineFor("light")
    for (const [name, fill] of Object.entries(pinFills("light"))) {
      const best = Math.max(contrastRatio(fill, ground), outline ? contrastRatio(outline, ground) : 0)
      expect(best, name).toBeGreaterThanOrEqual(PIN_NON_TEXT_CONTRAST)
    }
  })

  it("light needs the outline at all: water, cleanup and bloom fail on their own", () => {
    const ground = basemapPaper("light")
    const fills = pinFills("light")
    for (const name of ["water", "cleanup", "bloom"]) {
      expect(contrastRatio(fills[name]!, ground), name).toBeLessThan(PIN_NON_TEXT_CONTRAST)
    }
    expect(pinOutlineFor("light")).toBe(colorSchemes.light.neutral.ink)
  })

  it("dark draws no outline, since every dark fill already clears the dark-matter ground", () => {
    expect(pinOutlineFor("dark")).toBeNull()
  })

  it("PinSvg strokes the body with the scheme outline", () => {
    const src = readFileSync(new URL("../pins/PinSvg.tsx", import.meta.url), "utf8")
    expect(src).toContain("const outline = pinOutlineFor(t.scheme)")
    expect(src).toContain("stroke={outline ?? undefined}")
  })
})

describe("glyphs, counts and checks read against their own fill", () => {
  it("the picked ink gives every pin glyph 3:1 on its fill in both schemes", () => {
    for (const scheme of SCHEMES) {
      const onAccent = makeThemeColors(scheme).onAccent
      for (const [name, fill] of Object.entries(pinFills(scheme))) {
        expect(contrastRatio(inkOnFill(fill, scheme, onAccent), fill), `${scheme}/${name}`).toBeGreaterThanOrEqual(
          PIN_NON_TEXT_CONTRAST,
        )
      }
    }
  })

  it("the blend-pin count on bloom meets 4.5:1 (12px caption is not large text)", () => {
    for (const scheme of SCHEMES) {
      const onAccent = makeThemeColors(scheme).onAccent
      const bloom = colorSchemes[scheme].brand.bloom
      expect(contrastRatio(inkOnFill(bloom, scheme, onAccent), bloom), scheme).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("PinSvg, BlendPin and the layers check use the picker instead of a fixed onAccent", () => {
    const pinSvg = readFileSync(new URL("../pins/PinSvg.tsx", import.meta.url), "utf8")
    const blend = readFileSync(new URL("../pins/BlendPin.tsx", import.meta.url), "utf8")
    const layers = readFileSync(new URL("../LayersPopover.tsx", import.meta.url), "utf8")
    expect(pinSvg).toContain("stroke={inkOnFill(fill, t.scheme, t.colors.onAccent)}")
    expect(blend).toContain("color={inkOnFill(t.colors.brand.bloom, t.scheme, t.colors.onAccent)}")
    expect(layers).toContain("color={inkOnFill(color, th.scheme, th.colors.onAccent)}")
  })
})
