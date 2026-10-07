import { describe, expect, it } from "vitest"
import { eventDistanceLabel } from "../eventDistance"
import { METERS_PER_MILE } from "../reportHitRowModel"

describe("eventDistanceLabel precision boundary", () => {
  it("prints one decimal below ten miles and whole miles from ten up", () => {
    expect(eventDistanceLabel(9.94 * METERS_PER_MILE)).toBe("9.9 mi")
    expect(eventDistanceLabel(10 * METERS_PER_MILE)).toBe("10 mi")
    expect(eventDistanceLabel(10.5 * METERS_PER_MILE)).toBe("11 mi")
  })

  it("rounds a value just under ten up to a one-decimal 10.0", () => {
    expect(eventDistanceLabel(9.96 * METERS_PER_MILE)).toBe("10.0 mi")
  })

  it("converts with the statute mile", () => {
    expect(METERS_PER_MILE).toBeCloseTo(1609.344, 3)
    expect(eventDistanceLabel(1609.344 * 2.25)).toBe("2.3 mi")
  })

  it("prints an infinite distance as the locale's infinity sign rather than nothing", () => {
    expect(eventDistanceLabel(Number.POSITIVE_INFINITY)).toBe("∞ mi")
  })
})
