import { describe, expect, it } from "vitest"

import {
  amountInputValue,
  amountVerdict,
  formatMinor,
  formatMinorCompact,
  parseAmountToMinor,
} from "./donate-amount"

describe("parseAmountToMinor", () => {
  it("reads plain dollars", () => {
    expect(parseAmountToMinor("25")).toEqual({ ok: true, amountMinor: 2500 })
    expect(parseAmountToMinor("  25  ")).toEqual({ ok: true, amountMinor: 2500 })
  })

  it("reads a dollar sign", () => {
    expect(parseAmountToMinor("$25")).toEqual({ ok: true, amountMinor: 2500 })
    expect(parseAmountToMinor("$1,250")).toEqual({ ok: true, amountMinor: 125000 })
  })

  it("reads cents with either separator", () => {
    expect(parseAmountToMinor("4.99")).toEqual({ ok: true, amountMinor: 499 })
    expect(parseAmountToMinor("25,00")).toEqual({ ok: true, amountMinor: 2500 })
    expect(parseAmountToMinor("25.5")).toEqual({ ok: true, amountMinor: 2550 })
  })

  it("reads a comma as a thousands group only when the grouping is well formed", () => {
    expect(parseAmountToMinor("1,000")).toEqual({ ok: true, amountMinor: 100000 })
    expect(parseAmountToMinor("1,000,000")).toEqual({ ok: true, amountMinor: 100000000 })
    expect(parseAmountToMinor("12,3456")).toEqual({ ok: false, reason: "too_precise" })
  })

  it("refuses a dot followed by three digits rather than guessing between $1 and $1000", () => {
    expect(parseAmountToMinor("1.000")).toEqual({ ok: false, reason: "too_precise" })
  })

  it("refuses scientific notation rather than charging 100000 dollars", () => {
    expect(parseAmountToMinor("1e5")).toEqual({ ok: false, reason: "not_a_number" })
  })

  it("refuses sub-cent precision rather than rounding money", () => {
    expect(parseAmountToMinor("25.005")).toEqual({ ok: false, reason: "too_precise" })
    expect(parseAmountToMinor("25.5000")).toEqual({ ok: false, reason: "too_precise" })
  })

  it("refuses letters, signs and emptiness", () => {
    expect(parseAmountToMinor("")).toEqual({ ok: false, reason: "empty" })
    expect(parseAmountToMinor("abc")).toEqual({ ok: false, reason: "not_a_number" })
    expect(parseAmountToMinor("-25")).toEqual({ ok: false, reason: "not_a_number" })
    expect(parseAmountToMinor("25 USD")).toEqual({ ok: false, reason: "not_a_number" })
  })
})

describe("amountVerdict", () => {
  it("enforces the org's own bounds", () => {
    expect(amountVerdict("25", 500, 1_000_000)).toBe("ok")
    expect(amountVerdict("4", 500, 1_000_000)).toBe("below_min")
    expect(amountVerdict("20000", 500, 1_000_000)).toBe("above_max")
    expect(amountVerdict("", 500, 1_000_000)).toBe("empty")
    expect(amountVerdict("abc", 500, 1_000_000)).toBe("invalid")
  })
})

describe("formatting", () => {
  it("always renders two decimals in the money the donor commits to", () => {
    expect(formatMinor(2500)).toBe("$25.00")
    expect(formatMinor(499)).toBe("$4.99")
  })

  it("drops trailing zeros only on the preset chips", () => {
    expect(formatMinorCompact(2500)).toBe("$25")
    expect(formatMinorCompact(2550)).toBe("$25.50")
  })

  it("round-trips a preset into the input", () => {
    expect(amountInputValue(2500)).toBe("25")
    expect(amountInputValue(2550)).toBe("25.50")
    expect(parseAmountToMinor(amountInputValue(2550))).toEqual({ ok: true, amountMinor: 2550 })
  })
})
