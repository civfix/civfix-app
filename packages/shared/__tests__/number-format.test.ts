import { afterEach, describe, expect, it, vi } from "vitest"
import { formatCount } from "../src/number-format.js"

describe("formatCount", () => {
  it("prints whole counts with the locale's grouping", () => {
    expect(formatCount(1284, "en")).toBe("1,284")
    expect(formatCount(0, "en")).toBe("0")
    expect(formatCount(12.6, "en")).toBe("13")
    expect(formatCount(1284, "de")).toBe("1.284")
  })

  it("shortens large counts without hiding zero", () => {
    expect(formatCount(0, "en", { compact: true })).toBe("0")
    expect(formatCount(999, "en", { compact: true })).toBe("999")
    expect(formatCount(1_000, "en", { compact: true })).toBe("1K")
    expect(formatCount(1_500, "en", { compact: true })).toBe("1.5K")
    expect(formatCount(12_400, "en", { compact: true })).toBe("12K")
    expect(formatCount(1_250_000, "en", { compact: true })).toBe("1.3M")
    expect(formatCount(1_000_000_000, "en", { compact: true })).toBe("1B")
  })

  it("rolls a count that rounds up to the next unit into that unit", () => {
    expect(formatCount(999_999, "en", { compact: true })).toBe("1M")
  })

  it("uses the locale's own short scale", () => {
    expect(formatCount(1_250_000, "de", { compact: true })).toBe("1,3\u00a0Mio.")
    expect(formatCount(12_400, "ko", { compact: true })).toBe("1.2만")
    expect(formatCount(1_234, "de", { compact: true })).toBe("1234")
  })

  it("renders small axis ticks distinctly", () => {
    const labels = [0, 1, 2, 3].map((tick) => formatCount(tick, "en", { compact: true }))
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("falls back to en-US rather than throwing on a locale the runtime rejects", () => {
    expect(formatCount(1284, "!!not-a-locale")).toBe("1,284")
    expect(formatCount(12_400, "!!not-a-locale", { compact: true })).toBe("12K")
  })

  describe("on an engine that ignores compact notation", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("keeps the English short scale instead of printing the full number", () => {
      const resolved = Intl.NumberFormat.prototype.resolvedOptions
      vi.spyOn(Intl.NumberFormat.prototype, "resolvedOptions").mockImplementation(function (
        this: Intl.NumberFormat,
      ) {
        return { ...resolved.call(this), notation: "standard" }
      })
      expect(formatCount(0, "en", { compact: true })).toBe("0")
      expect(formatCount(999, "en", { compact: true })).toBe("999")
      expect(formatCount(1_000, "en", { compact: true })).toBe("1K")
      expect(formatCount(12_400, "en", { compact: true })).toBe("12K")
      expect(formatCount(1_250_000, "en", { compact: true })).toBe("1.3M")
      expect(formatCount(2_000_000_000, "en", { compact: true })).toBe("2B")
      expect(formatCount(-1_500, "en", { compact: true })).toBe("-1.5K")
      expect(formatCount(1_284, "en")).toBe("1,284")
    })
  })
})
