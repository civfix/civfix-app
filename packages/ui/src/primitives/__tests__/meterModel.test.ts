import { describe, expect, it } from "vitest"
import { meterFill, METER_WARN_AT } from "../meterModel"

describe("meterFill", () => {
  it("reports a plain ratio below the warn threshold", () => {
    expect(meterFill(20, 50)).toEqual({ ratio: 0.4, state: "ok" })
  })

  it("warns from the threshold up, and only says full at the limit", () => {
    expect(meterFill(45, 50)).toEqual({ ratio: 0.9, state: "warn" })
    expect(meterFill(49, 50).state).toBe("warn")
    expect(meterFill(50, 50)).toEqual({ ratio: 1, state: "full" })
  })

  it("clamps an over-subscribed count to the track instead of overflowing it", () => {
    expect(meterFill(80, 50)).toEqual({ ratio: 1, state: "full" })
  })

  it("takes a caller's own warn threshold", () => {
    expect(meterFill(30, 50, 0.5)).toEqual({ ratio: 0.6, state: "warn" })
    expect(METER_WARN_AT).toBe(0.9)
  })

  it("draws nothing when there is no limit to measure against", () => {
    expect(meterFill(12, 0)).toEqual({ ratio: 0, state: "ok" })
    expect(meterFill(12, Number.NaN)).toEqual({ ratio: 0, state: "ok" })
    expect(meterFill(Number.NaN, 40)).toEqual({ ratio: 0, state: "ok" })
  })

  it("leaves the fill plain when the caller has no warn threshold", () => {
    expect(meterFill(45, 50, null)).toEqual({ ratio: 0.9, state: "ok" })
    expect(meterFill(50, 50, null)).toEqual({ ratio: 1, state: "ok" })
  })

  it("never reports a negative fill", () => {
    expect(meterFill(-4, 50)).toEqual({ ratio: 0, state: "ok" })
  })
})
