import { describe, expect, it } from "vitest"

import { intentKey, type DonationIntent } from "./donate-intent"

const BASE: DonationIntent = {
  slug: "reach-out-la",
  amountMinor: 2500,
  email: "donor@example.org",
  name: "Ada",
  eventId: null,
  shareIdentity: false,
}

describe("intentKey", () => {
  it("is stable for an unchanged intent, so an indeterminate retry REPLAYS", () => {
    expect(intentKey("n1", BASE)).toBe(intentKey("n1", { ...BASE }))
  })

  it("changes when the amount changes, so a corrected amount is a NEW donation", () => {
    expect(intentKey("n1", { ...BASE, amountMinor: 25000 })).not.toBe(intentKey("n1", BASE))
  })

  it("changes when the receipt address changes", () => {
    expect(intentKey("n1", { ...BASE, email: "typo@example.org" })).not.toBe(intentKey("n1", BASE))
  })

  it("changes for name, event and the identity opt-in", () => {
    for (const patch of [
      { name: "Grace" },
      { eventId: "evt_1" },
      { shareIdentity: true },
      { slug: "other-org" },
    ] as Array<Partial<DonationIntent>>) {
      expect(intentKey("n1", { ...BASE, ...patch })).not.toBe(intentKey("n1", BASE))
    }
  })

  it("changes when the nonce is re-minted after a determinate refusal", () => {
    expect(intentKey("n2", BASE)).not.toBe(intentKey("n1", BASE))
  })

  it("cannot collide across a field boundary", () => {
    const a = intentKey("n1", { ...BASE, email: "ab@x.org", name: "c" })
    const b = intentKey("n1", { ...BASE, email: "ab@x.orgc", name: "" })
    expect(a).not.toBe(b)
  })

  it("stays inside the contract's 8..128 character bound", () => {
    const key = intentKey("n1", { ...BASE, name: "x".repeat(120), email: "y".repeat(200) })
    expect(key.length).toBeGreaterThanOrEqual(8)
    expect(key.length).toBeLessThanOrEqual(128)
  })
})
