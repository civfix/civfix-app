import { describe, expect, it, vi } from "vitest"

import { NOT_FOUND_VARIANTS, pickNotFoundVariant } from "./not-found-variant"

describe("pickNotFoundVariant", () => {
  it("draws from the injected random, once per pick", () => {
    const random = vi.fn(() => 0.5)
    expect(pickNotFoundVariant(random)).toBe("pothole")
    expect(random).toHaveBeenCalledTimes(1)
  })

  it("splits [0, 1) into three equal bands", () => {
    expect(pickNotFoundVariant(() => 0)).toBe("tiles")
    expect(pickNotFoundVariant(() => 1 / 3 - 1e-9)).toBe("tiles")
    expect(pickNotFoundVariant(() => 1 / 3)).toBe("pothole")
    expect(pickNotFoundVariant(() => 2 / 3 - 1e-9)).toBe("pothole")
    expect(pickNotFoundVariant(() => 2 / 3)).toBe("sign")
    expect(pickNotFoundVariant(() => 1 - Number.EPSILON)).toBe("sign")
  })

  it("is uniform over the three variants", () => {
    const draws = 3000
    const counts = new Map<string, number>()
    for (let i = 0; i < draws; i++) {
      const variant = pickNotFoundVariant(() => (i + 0.5) / draws)
      counts.set(variant, (counts.get(variant) ?? 0) + 1)
    }
    expect(Object.fromEntries(counts)).toEqual(
      Object.fromEntries(NOT_FOUND_VARIANTS.map((v) => [v, draws / NOT_FOUND_VARIANTS.length])),
    )
  })

  it("falls back to Math.random when no random is injected", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.9)
    try {
      expect(pickNotFoundVariant()).toBe("sign")
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
})
