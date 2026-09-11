import { describe, expect, it } from "vitest"
import {
  formatRate,
  formatStatValue,
  statTileColumns,
  STAT_TILE_WIDE_AT,
  STAT_VALUE_UNKNOWN,
} from "../statTileModel"

describe("formatStatValue", () => {
  it("groups thousands and drops decimals", () => {
    expect(formatStatValue(1284)).toBe("1,284")
    expect(formatStatValue(0)).toBe("0")
    expect(formatStatValue(12.6)).toBe("13")
  })

  it("follows the active locale's grouping", () => {
    expect(formatStatValue(1284, "de")).toBe("1.284")
  })

  it("returns null for an unknown value so the caller renders the em dash", () => {
    expect(formatStatValue(null)).toBeNull()
    expect(formatStatValue(Number.NaN)).toBeNull()
    expect(STAT_VALUE_UNKNOWN).toBe("—")
  })
})

describe("formatRate", () => {
  it("renders a 0..1 rate as a whole percent", () => {
    expect(formatRate(0.82)).toBe("82%")
    expect(formatRate(0.8249)).toBe("82%")
    expect(formatRate(1)).toBe("100%")
    expect(formatRate(0)).toBe("0%")
  })

  it("returns null for an unknown rate", () => {
    expect(formatRate(null)).toBeNull()
  })
})

describe("statTileColumns", () => {
  it("switches to four across at the wide density, not before", () => {
    expect(statTileColumns(STAT_TILE_WIDE_AT - 1)).toBe(2)
    expect(statTileColumns(STAT_TILE_WIDE_AT)).toBe(4)
    expect(statTileColumns(608)).toBe(4)
    expect(statTileColumns(268)).toBe(2)
  })
})
