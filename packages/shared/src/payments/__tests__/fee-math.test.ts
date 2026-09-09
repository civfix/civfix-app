import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROCESSOR_FEE_BPS,
  DEFAULT_PROCESSOR_FEE_FIXED_MINOR,
  effectiveFeeBps,
  estimateProcessorFeeMinor,
  platformFeeMinor,
  previewDonationFees,
} from "../fee-math.js"

describe("platformFeeMinor", () => {
  it("applies the bps rate with half-up rounding", () => {
    expect(platformFeeMinor(10000, 500)).toBe(500)
    expect(platformFeeMinor(101, 500)).toBe(5)
    expect(platformFeeMinor(110, 500)).toBe(6)
    expect(platformFeeMinor(1, 5000)).toBe(1)
    expect(platformFeeMinor(1, 4999)).toBe(0)
  })

  it("is zero when the rate or the amount is zero", () => {
    expect(platformFeeMinor(10000, 0)).toBe(0)
    expect(platformFeeMinor(0, 500)).toBe(0)
  })

  it("never exceeds the gross amount", () => {
    expect(platformFeeMinor(500, 10000)).toBe(500)
  })

  it("refuses non-integer, negative and out-of-range input", () => {
    expect(() => platformFeeMinor(10.5, 500)).toThrow(RangeError)
    expect(() => platformFeeMinor(-1, 500)).toThrow(RangeError)
    expect(() => platformFeeMinor(1000, -1)).toThrow(RangeError)
    expect(() => platformFeeMinor(1000, 10001)).toThrow(RangeError)
    expect(() => platformFeeMinor(Number.NaN, 500)).toThrow(RangeError)
  })
})

describe("estimateProcessorFeeMinor", () => {
  it("defaults to 2.9% + 30c", () => {
    expect(DEFAULT_PROCESSOR_FEE_BPS).toBe(290)
    expect(DEFAULT_PROCESSOR_FEE_FIXED_MINOR).toBe(30)
    expect(estimateProcessorFeeMinor(10000)).toBe(320)
    expect(estimateProcessorFeeMinor(500)).toBe(45)
  })

  it("accepts an override and never exceeds the gross", () => {
    expect(estimateProcessorFeeMinor(10000, { bps: 250, fixedMinor: 0 })).toBe(250)
    expect(estimateProcessorFeeMinor(10, { bps: 0, fixedMinor: 500 })).toBe(10)
    expect(estimateProcessorFeeMinor(0)).toBe(0)
  })
})

describe("previewDonationFees", () => {
  it("returns an integer breakdown that reconciles", () => {
    const preview = previewDonationFees({ amountMinor: 5000, platformFeeBps: 500 })
    expect(preview).toEqual({
      grossMinor: 5000,
      platformFeeMinor: 250,
      estimatedProcessingFeeMinor: 175,
      estimatedNetMinor: 4575,
      platformFeeBps: 500,
    })
    expect(
      preview.platformFeeMinor + preview.estimatedProcessingFeeMinor + preview.estimatedNetMinor,
    ).toBe(preview.grossMinor)
  })

  it("clamps the net at zero when fees swallow a tiny donation", () => {
    const preview = previewDonationFees({
      amountMinor: 50,
      platformFeeBps: 10000,
      processingFeeBps: 290,
      processingFeeFixedMinor: 30,
    })
    expect(preview.estimatedNetMinor).toBe(0)
  })

  it("omits the platform fee at 0 bps", () => {
    expect(previewDonationFees({ amountMinor: 2500, platformFeeBps: 0 }).platformFeeMinor).toBe(0)
  })

  it("is deterministic", () => {
    const input = { amountMinor: 12345, platformFeeBps: 500 }
    expect(previewDonationFees(input)).toEqual(previewDonationFees(input))
  })
})

describe("effectiveFeeBps", () => {
  it("takes the lower of the configured and the agreed rate", () => {
    expect(effectiveFeeBps(500, 500)).toBe(500)
    expect(effectiveFeeBps(800, 500)).toBe(500)
    expect(effectiveFeeBps(300, 500)).toBe(300)
  })
})
