import { describe, expect, it } from "vitest"
import { EMPTY_VALUE } from "../../i18n/emptyValue"
import {
  formatRate,
  formatStatValue,
  statTileColumns,
  STAT_TILE_WIDE_AT,
  STAT_VALUE_UNKNOWN,
  statValueSize,
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

  it("returns null for an unknown value so the caller renders the shared empty mark", () => {
    expect(formatStatValue(null)).toBeNull()
    expect(formatStatValue(Number.NaN)).toBeNull()
    expect(STAT_VALUE_UNKNOWN).toBe(EMPTY_VALUE)
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

describe("statValueSize", () => {
  it("keeps the display size for a value that fits the cell", () => {
    expect(statValueSize("412", 4)).toBe("24")
    expect(statValueSize("82%", 4)).toBe("24")
    expect(statValueSize("$461.30", 2)).toBe("24")
    expect(statValueSize(null, 4)).toBe("24")
  })

  it("steps the value down rather than truncating it in a four-up row", () => {
    expect(statValueSize("$461.30", 4)).toBe("20")
    expect(statValueSize("114.5 h", 4)).toBe("20")
    expect(statValueSize("$1,151.00", 4)).toBe("20")
    expect(statValueSize("$12,451.00", 4)).toBe("18")
  })

  it("only steps a two-up value down when it is genuinely long", () => {
    expect(statValueSize("$12,451.00", 2)).toBe("24")
    expect(statValueSize("$1,204,451.00", 2)).toBe("20")
    expect(statValueSize("$1,204,451,882.00", 2)).toBe("18")
  })
})
