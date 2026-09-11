import { describe, expect, it } from "vitest"
import {
  payoutIdempotencyKey,
  payoutIntent,
  releasePayoutIntent,
} from "../hooks/payouts"

describe("a payout idempotency key is bound to the payout it authorizes", () => {
  it("hands the SAME key back while the org and amount are unchanged", () => {
    const intent = payoutIntent("org_a", 5000)
    const first = payoutIdempotencyKey(intent)

    expect(payoutIdempotencyKey(intent)).toBe(first)
    expect(payoutIdempotencyKey(payoutIntent("org_a", 5000))).toBe(first)

    releasePayoutIntent(intent)
  })

  it("mints a DIFFERENT key once the amount changes, so a corrected retry is its own payout", () => {
    const five = payoutIntent("org_b", 5000)
    const other = payoutIntent("org_b", 500)

    expect(payoutIdempotencyKey(five)).not.toBe(payoutIdempotencyKey(other))

    releasePayoutIntent(five)
    releasePayoutIntent(other)
  })

  it("keeps orgs apart, and reads a missing amount as the whole available balance", () => {
    expect(payoutIntent("org_c", null)).toBe("org_c:available")
    expect(payoutIntent("org_c", undefined)).toBe("org_c:available")
    expect(payoutIntent("org_c", null)).not.toBe(payoutIntent("org_d", null))
  })

  it("releases the key only after the payout lands, so the next one is genuinely new", () => {
    const intent = payoutIntent("org_e", 2500)
    const first = payoutIdempotencyKey(intent)

    releasePayoutIntent(intent)

    expect(payoutIdempotencyKey(intent)).not.toBe(first)
    releasePayoutIntent(intent)
  })
})
