import { describe, expect, it } from "vitest"
import { K_SUPPRESS, suppressCount, suppressRate } from "../suppress.js"

describe("suppressCount", () => {
  it("uses k = 5 by default", () => {
    expect(K_SUPPRESS).toBe(5)
  })

  it("nulls anything under k and passes k through", () => {
    expect(suppressCount(4)).toEqual({ suppressed: true, value: null })
    expect(suppressCount(5)).toEqual({ suppressed: false, value: 5 })
    expect(suppressCount(0)).toEqual({ suppressed: true, value: null })
  })

  it("honours a caller-supplied k", () => {
    expect(suppressCount(4, 3)).toEqual({ suppressed: false, value: 4 })
    expect(suppressCount(9, 10)).toEqual({ suppressed: true, value: null })
  })

  it("floors garbage input instead of leaking NaN", () => {
    expect(suppressCount(Number.NaN)).toEqual({ suppressed: true, value: null })
    expect(suppressCount(-12)).toEqual({ suppressed: true, value: null })
    expect(suppressCount(7.9)).toEqual({ suppressed: false, value: 7 })
  })
})

describe("suppressRate", () => {
  it("is null whenever the denominator is under k", () => {
    expect(suppressRate(2, 4)).toEqual({ suppressed: true, value: null })
    expect(suppressRate(0, 0)).toEqual({ suppressed: true, value: null })
  })

  it("returns a bounded ratio once the denominator clears k", () => {
    expect(suppressRate(1, 5)).toEqual({ suppressed: false, value: 0.2 })
    expect(suppressRate(1, 3, 3)).toEqual({ suppressed: false, value: 0.3333 })
  })

  it("never reports more than 100%", () => {
    expect(suppressRate(50, 10)).toEqual({ suppressed: false, value: 1 })
  })

  it("is deterministic across repeated calls", () => {
    const first = suppressRate(7, 13, 5)
    const second = suppressRate(7, 13, 5)
    expect(first).toEqual(second)
  })
})
