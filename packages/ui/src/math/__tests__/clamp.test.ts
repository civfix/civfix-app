import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { clamp, clamp01 } from "../clamp"

describe("clamp01", () => {
  it("passes a value inside [0, 1] through", () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(1)).toBe(1)
  })

  it("pins a value outside [0, 1] to the nearer end", () => {
    expect(clamp01(-3)).toBe(0)
    expect(clamp01(9)).toBe(1)
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it("passes NaN through, leaving the non-finite policy to the caller", () => {
    expect(clamp01(Number.NaN)).toBeNaN()
  })
})

describe("clamp", () => {
  it("keeps a value between its bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it("lets the upper bound win when the bounds cross", () => {
    expect(clamp(5, 10, 0)).toBe(0)
  })
})

describe("the math module", () => {
  it("keeps both helpers callable from a reanimated worklet", () => {
    const source = readFileSync(new URL("../clamp.ts", import.meta.url), "utf8")
    expect(source.match(/^\s+"worklet"$/gm) ?? []).toHaveLength(2)
    expect(source).not.toMatch(/from "react-native"/)
  })
})
