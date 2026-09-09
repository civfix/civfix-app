import { describe, expect, it } from "vitest"
import { DonationStatusSchema, type DonationStatus } from "../../schemas/common.js"
import {
  DONATION_STATUS_RANK,
  advanceStatus,
  isRefundStatusCorrection,
  isSettledDonationStatus,
  isTerminalDonationStatus,
  refundedDonationStatus,
} from "../donation-state.js"

const ALL: readonly DonationStatus[] = DonationStatusSchema.options

describe("DONATION_STATUS_RANK", () => {
  it("ranks every donation status exactly once", () => {
    expect(Object.keys(DONATION_STATUS_RANK).sort()).toEqual([...ALL].sort())
    const ranks = Object.values(DONATION_STATUS_RANK)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it("orders pending < failed < succeeded < partially_refunded < refunded", () => {
    expect(DONATION_STATUS_RANK.pending).toBeLessThan(DONATION_STATUS_RANK.failed)
    expect(DONATION_STATUS_RANK.failed).toBeLessThan(DONATION_STATUS_RANK.succeeded)
    expect(DONATION_STATUS_RANK.succeeded).toBeLessThan(DONATION_STATUS_RANK.partially_refunded)
    expect(DONATION_STATUS_RANK.partially_refunded).toBeLessThan(DONATION_STATUS_RANK.refunded)
  })
})

describe("advanceStatus", () => {
  it("is monotone over every ordered pair", () => {
    for (const current of ALL) {
      for (const next of ALL) {
        const result = advanceStatus(current, next)
        expect(DONATION_STATUS_RANK[result]).toBeGreaterThanOrEqual(DONATION_STATUS_RANK[current])
        expect(result).toBe(
          DONATION_STATUS_RANK[next] > DONATION_STATUS_RANK[current] ? next : current,
        )
      }
    }
  })

  it("is idempotent and never regresses out of order webhooks", () => {
    expect(advanceStatus("succeeded", "pending")).toBe("succeeded")
    expect(advanceStatus("succeeded", "failed")).toBe("succeeded")
    expect(advanceStatus("refunded", "partially_refunded")).toBe("refunded")
    expect(advanceStatus("succeeded", "succeeded")).toBe("succeeded")
  })

  it("still lets a retried session move failed to succeeded", () => {
    expect(advanceStatus("failed", "succeeded")).toBe("succeeded")
    expect(advanceStatus("pending", "failed")).toBe("failed")
  })

  it("is associative over a shuffled event stream", () => {
    const stream: DonationStatus[] = ["pending", "failed", "succeeded", "partially_refunded", "refunded"]
    const forward = stream.reduce<DonationStatus>((acc, next) => advanceStatus(acc, next), "pending")
    const reversed = [...stream].reverse().reduce<DonationStatus>((acc, next) => advanceStatus(acc, next), "pending")
    expect(forward).toBe("refunded")
    expect(reversed).toBe("refunded")
  })
})

describe("refundedDonationStatus", () => {
  it("derives the settled status from the recomputed refunded total", () => {
    const amountMinor = 5000
    expect(refundedDonationStatus({ current: "succeeded", amountMinor, refundedTotalMinor: 0 })).toBe(
      "succeeded",
    )
    expect(
      refundedDonationStatus({ current: "succeeded", amountMinor, refundedTotalMinor: 2500 }),
    ).toBe("partially_refunded")
    expect(
      refundedDonationStatus({ current: "succeeded", amountMinor, refundedTotalMinor: 5000 }),
    ).toBe("refunded")
  })

  it("walks a donation back when the only refund failed", () => {
    expect(
      refundedDonationStatus({ current: "refunded", amountMinor: 5000, refundedTotalMinor: 0 }),
    ).toBe("succeeded")
    expect(
      refundedDonationStatus({
        current: "refunded",
        amountMinor: 5000,
        refundedTotalMinor: 2500,
      }),
    ).toBe("partially_refunded")
  })

  it("never un-settles a donation that has not settled", () => {
    for (const current of ["pending", "failed"] as const) {
      expect(refundedDonationStatus({ current, amountMinor: 5000, refundedTotalMinor: 5000 })).toBe(
        current,
      )
    }
  })

  it("flags only backward moves inside the settled band as corrections", () => {
    expect(isRefundStatusCorrection("refunded", "succeeded")).toBe(true)
    expect(isRefundStatusCorrection("partially_refunded", "succeeded")).toBe(true)
    expect(isRefundStatusCorrection("succeeded", "refunded")).toBe(false)
    expect(isRefundStatusCorrection("succeeded", "succeeded")).toBe(false)
    expect(isRefundStatusCorrection("pending", "failed")).toBe(false)
  })
})

describe("status predicates", () => {
  it("treats only refunded as terminal", () => {
    for (const status of ALL) expect(isTerminalDonationStatus(status)).toBe(status === "refunded")
  })

  it("treats succeeded and beyond as settled", () => {
    expect(isSettledDonationStatus("pending")).toBe(false)
    expect(isSettledDonationStatus("failed")).toBe(false)
    expect(isSettledDonationStatus("succeeded")).toBe(true)
    expect(isSettledDonationStatus("partially_refunded")).toBe(true)
    expect(isSettledDonationStatus("refunded")).toBe(true)
  })
})
