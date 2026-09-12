import { describe, expect, it } from "vitest"
import { tokens, darkColor } from "@civfix/shared/tokens"
import {
  APPEARANCE_PREFERENCES,
  isAppearancePreference,
  makeGlass,
  makeThemeColors,
  resolveColorScheme,
} from "../schemes"

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe("resolveColorScheme", () => {
  it("follows the system only for the system preference", () => {
    expect(resolveColorScheme("system", "dark")).toBe("dark")
    expect(resolveColorScheme("system", "light")).toBe("light")
    expect(resolveColorScheme("system", null)).toBe("light")
    expect(resolveColorScheme("system", undefined)).toBe("light")
    expect(resolveColorScheme("light", "dark")).toBe("light")
    expect(resolveColorScheme("dark", "light")).toBe("dark")
  })

  it("guards the persisted preference space", () => {
    for (const p of APPEARANCE_PREFERENCES) expect(isAppearancePreference(p)).toBe(true)
    expect(isAppearancePreference("auto")).toBe(false)
    expect(isAppearancePreference(null)).toBe(false)
    expect(isAppearancePreference(1)).toBe(false)
  })
})

describe("theme color schemes", () => {
  const light = makeThemeColors("light")
  const dark = makeThemeColors("dark")

  it("exposes the same semantic keys in both schemes", () => {
    expect(leafPaths(dark).sort()).toEqual(leafPaths(light).sort())
  })

  it("keeps the light scheme byte-identical to the historical theme aliases", () => {
    expect(light.bg).toBe(tokens.color.neutral.paper)
    expect(light.surface).toBe(tokens.color.neutral.card)
    expect(light.text).toBe(tokens.color.neutral.ink)
    expect(light.border).toBe(tokens.color.neutral.ink5)
    expect(light.accent).toBe(tokens.color.brand.bloom)
    expect(light.accentText).toBe("#B03A2C")
    expect(light.sun["700"]).toBe("#A77B0A")
    expect(light.lilac["100"]).toBe("#DED2F5")
    expect(light.lilac["300"]).toBe("#BFA9EC")
    expect(light.glass).toBe("rgba(255,255,255,0.82)")
    expect(light.scrimModal).toBe("rgba(26,23,20,0.45)")
    expect(light.shadowColor).toBe(tokens.color.neutral.ink)
  })

  it("re-derives the dark aliases from the dark palette", () => {
    expect(dark.bg).toBe(darkColor.neutral.paper)
    expect(dark.surface).toBe(darkColor.neutral.card)
    expect(dark.text).toBe(darkColor.neutral.ink)
    expect(dark.border).toBe(darkColor.neutral.ink5)
    expect(dark.accent).toBe(darkColor.brand.bloom)
    expect(dark.category.hazard).toBe(darkColor.category.hazard)
    expect(dark.shadowColor).toBe("#000000")
  })

  it("passes the semantic roles through from the palette, unrecoloured", () => {
    expect(light.dangerInk).toBe(tokens.color.semantic.dangerInk)
    expect(light.chartInk).toBe(tokens.color.semantic.chartInk)
    expect(light.chartTrack).toBe(tokens.color.semantic.chartTrack)
    expect(light.selectedFill).toBe(tokens.color.semantic.selectedFill)
    expect(dark.dangerInk).toBe(darkColor.semantic.dangerInk)
    expect(dark.chartInk).toBe(darkColor.semantic.chartInk)
    expect(dark.selectedFill).toBe(darkColor.semantic.selectedFill)
  })

  it("labels the coral CTA with the scheme's ink neutral, leaving onAccent alone", () => {
    expect(light.onCta).toBe(tokens.color.neutral.ink)
    expect(dark.onCta).toBe(darkColor.neutral.paper)
    expect(light.onAccent).toBe("#FFFFFF")
    expect(dark.onAccent).toBe(darkColor.neutral.paper)
  })

  it("inverts the glass active state with the palette", () => {
    const lightGlass = makeGlass("light")
    const darkGlass = makeGlass("dark")
    expect(leafPaths(darkGlass).sort()).toEqual(leafPaths(lightGlass).sort())
    expect(lightGlass.active).toEqual({ fill: tokens.color.neutral.ink, icon: tokens.color.neutral.card })
    expect(darkGlass.active).toEqual({ fill: darkColor.neutral.ink, icon: darkColor.neutral.card })
    expect(darkGlass.dock.height).toBe(lightGlass.dock.height)
    expect(darkGlass.dock.orbSize).toBe(lightGlass.dock.orbSize)
    expect(darkGlass.dock.blurIntensity).toBe(lightGlass.dock.blurIntensity)
  })
})
