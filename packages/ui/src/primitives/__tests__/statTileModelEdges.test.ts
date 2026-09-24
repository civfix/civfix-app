import { describe, expect, it } from "vitest"
import { STAT_VALUE_SIZES, formatRate, formatStatValue, statTileColumns, statValueSize } from "../statTileModel"

describe("formatStatValue edges", () => {
  it("returns null for both infinities", () => {
    expect(formatStatValue(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatStatValue(Number.NEGATIVE_INFINITY)).toBeNull()
  })

  it("formats negatives and rounds half away from zero", () => {
    expect(formatStatValue(-1284)).toBe("-1,284")
    expect(formatStatValue(2.5)).toBe("3")
  })

  it("defaults to US English grouping", () => {
    expect(formatStatValue(1234567)).toBe("1,234,567")
  })
})

describe("formatRate edges", () => {
  it("returns null for NaN and infinity", () => {
    expect(formatRate(Number.NaN)).toBeNull()
    expect(formatRate(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("does not clamp a rate outside 0..1", () => {
    expect(formatRate(1.5)).toBe("150%")
    expect(formatRate(-0.1)).toBe("-10%")
  })

  it("follows the locale's percent style", () => {
    expect(formatRate(0.82, "de")).toBe("82\u00a0%")
  })
})

describe("statTileColumns edges", () => {
  it("stays two-up for a zero or unmeasured width", () => {
    expect(statTileColumns(0)).toBe(2)
    expect(statTileColumns(Number.NaN)).toBe(2)
  })
})

describe("statValueSize boundaries", () => {
  it("lists the three steps from largest to smallest", () => {
    expect(STAT_VALUE_SIZES).toEqual(["24", "20", "18"])
  })

  it("steps at exactly one character past each four-up budget", () => {
    expect(statValueSize("a".repeat(6), 4)).toBe("24")
    expect(statValueSize("a".repeat(7), 4)).toBe("20")
    expect(statValueSize("a".repeat(9), 4)).toBe("20")
    expect(statValueSize("a".repeat(10), 4)).toBe("18")
  })

  it("steps at exactly one character past each two-up budget", () => {
    expect(statValueSize("a".repeat(12), 2)).toBe("24")
    expect(statValueSize("a".repeat(13), 2)).toBe("20")
    expect(statValueSize("a".repeat(16), 2)).toBe("20")
    expect(statValueSize("a".repeat(17), 2)).toBe("18")
  })

  it("counts code points, not UTF-16 units", () => {
    expect(statValueSize("😀".repeat(6), 4)).toBe("24")
  })

  it("keeps the em dash placeholder at display size", () => {
    expect(statValueSize("—", 4)).toBe("24")
  })
})
