import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { colorSchemes, type ColorSchemeName } from "@civfix/tokens"
import { contrastRatio } from "@civfix/tokens/chip-contrast"
import { ACTIVE_SEASON, seasonLook } from "../season"

const SCHEMES: readonly ColorSchemeName[] = ["light", "dark"]
const L = colorSchemes.light
const D = colorSchemes.dark

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (typeof value !== "object" || value === null) return []
  return Object.values(value as Record<string, unknown>).flatMap(leaves)
}

function christmas() {
  const look = seasonLook("christmas")
  expect(look).not.toBeNull()
  if (look === null) throw new Error("no christmas look")
  return look
}

describe("the season switch", () => {
  it("T1: ships switched to christmas", () => {
    expect(ACTIVE_SEASON).toBe("christmas")
  })

  it("T2: has no look for the everyday season", () => {
    expect(seasonLook("none")).toBeNull()
  })
})

describe("the christmas look", () => {
  it("T3: colors the six letters red, gold, green twice from the palette", () => {
    const { wordmark } = christmas()
    expect(wordmark.light).toEqual([
      L.bloom["700"],
      L.sun["600"],
      L.moss["700"],
      L.bloom["700"],
      L.sun["600"],
      L.moss["700"],
    ])
    expect(wordmark.dark).toEqual([
      D.bloom["500"],
      D.sun["600"],
      D.moss["600"],
      D.bloom["500"],
      D.sun["600"],
      D.moss["600"],
    ])
  })

  it("T4: takes the garland and hat colors from the palette per scheme", () => {
    const { garland, hat } = christmas()
    expect(garland).toEqual({
      light: { leaf: L.moss["700"], berry: L.bloom["700"], cord: L.moss["600"] },
      dark: { leaf: D.moss["500"], berry: D.bloom["500"], cord: D.moss["300"] },
    })
    expect(hat).toEqual({
      light: { felt: L.bloom["700"], trim: L.neutral.card, edge: L.neutral.ink4 },
      dark: { felt: D.bloom["500"], trim: D.neutral.ink, edge: D.neutral.ink },
    })
  })

  it("T5: uses no color outside the scheme's tokens", () => {
    const look = christmas()
    for (const scheme of SCHEMES) {
      const palette = new Set(leaves(colorSchemes[scheme]))
      const used = [
        ...look.wordmark[scheme],
        ...leaves(look.garland?.[scheme]),
        ...leaves(look.hat?.[scheme]),
      ]
      expect(used.length).toBeGreaterThan(0)
      for (const color of used) expect(palette.has(color), `${scheme} ${color}`).toBe(true)
    }
  })

  it("T6: keeps every letter at 3:1 or better on the card in both schemes", () => {
    const { wordmark } = christmas()
    for (const scheme of SCHEMES) {
      const card = colorSchemes[scheme].neutral.card
      for (const letter of wordmark[scheme]) {
        expect(contrastRatio(letter, card), `${scheme} ${letter}`).toBeGreaterThanOrEqual(3.0)
      }
    }
  })
})

describe("theme/season is RN-free", () => {
  it("T7: imports no react-native", () => {
    const specifiers = [...strip(read("../season.ts")).matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1],
    )
    for (const specifier of specifiers) {
      expect(specifier, specifier).not.toMatch(/^react(-native)?($|\/|-)/)
      expect(specifier, specifier).not.toBe("react-dom")
    }
  })
})
