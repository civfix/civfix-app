import { describe, it, expect } from "vitest"
import { colorSchemes, type ColorSchemeName } from "@civfix/shared/tokens"
import { makeThemeColors } from "../../theme/schemes"
import { clusterBubbleAppearance, clusterToneFor } from "../pins/appearance"

const SCHEMES: ColorSchemeName[] = ["light", "dark"]

function luminance(hex: string): number {
  const channel = (index: number): number => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

describe("clusterToneFor", () => {
  it("only calls a bubble an events bubble when it holds no reports", () => {
    expect(clusterToneFor(0, 3)).toBe("events")
    expect(clusterToneFor(1, 3)).toBe("reports")
    expect(clusterToneFor(4, 0)).toBe("reports")
  })
})

describe("clusterBubbleAppearance", () => {
  it("keeps the count legible on the bubble in both schemes and both tones", () => {
    for (const scheme of SCHEMES) {
      for (const tone of ["reports", "events"] as const) {
        const { fill, label } = clusterBubbleAppearance(
          tone,
          scheme,
          makeThemeColors(scheme).onAccent,
        )
        expect(contrast(label, fill), `${tone}/${scheme}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it("gives the events tone the cleanup colour so it reads apart from a reports bubble", () => {
    for (const scheme of SCHEMES) {
      const onAccent = makeThemeColors(scheme).onAccent
      expect(clusterBubbleAppearance("events", scheme, onAccent).fill).toBe(
        colorSchemes[scheme].cleanup,
      )
      expect(clusterBubbleAppearance("reports", scheme, onAccent).fill).toBe(
        colorSchemes[scheme].brand.bloom,
      )
    }
  })
})
