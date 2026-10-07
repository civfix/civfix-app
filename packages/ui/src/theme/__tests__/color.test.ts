import { describe, expect, it } from "vitest"
import { hexWithAlpha, tint, wash } from "../color"
import type { Theme } from "../themes"

describe("hexWithAlpha", () => {
  it("appends the opacity as a two-digit alpha byte to a six-digit hex", () => {
    expect(hexWithAlpha("#112233", 0.5)).toBe("#11223380")
    expect(hexWithAlpha("#112233", 0)).toBe("#11223300")
    expect(hexWithAlpha("#112233", 1)).toBe("#112233ff")
  })

  it("rounds to the nearest byte, so 0.12 and 0.1 land on 0x1f and 0x1a", () => {
    expect(hexWithAlpha("#112233", 0.12)).toBe("#1122331f")
    expect(hexWithAlpha("#112233", 0.1)).toBe("#1122331a")
  })

  it("clamps the opacity into [0, 1]", () => {
    expect(hexWithAlpha("#112233", -1)).toBe("#11223300")
    expect(hexWithAlpha("#112233", 2)).toBe("#112233ff")
  })

  it("passes any other color form through unchanged", () => {
    expect(hexWithAlpha("rgba(0,0,0,0.2)", 0.5)).toBe("rgba(0,0,0,0.2)")
    expect(hexWithAlpha("#123", 0.5)).toBe("#123")
  })
})

describe("wash", () => {
  const surface = "#000000"
  const themeOf = (scheme: "light" | "dark") => ({ scheme, colors: { surface } }) as unknown as Theme

  it("tints toward white in light", () => {
    expect(wash("#808080", 0.5, themeOf("light"))).toBe(tint("#808080", 0.5))
    expect(tint("#808080", 0.5)).toBe("rgb(192, 192, 192)")
  })

  it("mixes toward the surface in dark", () => {
    expect(wash("#808080", 0.5, themeOf("dark"))).toBe("rgb(64, 64, 64)")
  })
})
