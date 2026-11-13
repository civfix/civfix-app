import { describe, expect, it } from "vitest"
import { tokens } from "@civfix/tokens"
import { wordmarkColorsFor } from "../index"
import { seasonLook } from "../season"

const { brand, sun } = tokens.color

describe("wordmarkColorsFor", () => {
  it("T8: gives today's letters in both schemes when no season is on", () => {
    const today = [brand.bloom, sun["600"], brand.moss, brand.sky, brand.lilac, brand.bloom]
    expect(wordmarkColorsFor("light", "none")).toEqual(today)
    expect(wordmarkColorsFor("dark", "none")).toEqual(today)
  })

  it("T9: gives the christmas letters for each scheme when christmas is on", () => {
    const look = seasonLook("christmas")
    expect(wordmarkColorsFor("light", "christmas")).toEqual(look?.wordmark.light)
    expect(wordmarkColorsFor("dark", "christmas")).toEqual(look?.wordmark.dark)
  })
})
