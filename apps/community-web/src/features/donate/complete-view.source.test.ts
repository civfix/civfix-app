import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const completeView = readFileSync(
  fileURLToPath(new URL("./complete-view.tsx", import.meta.url)),
  "utf8",
)
const donateView = readFileSync(
  fileURLToPath(new URL("./donate-view.tsx", import.meta.url)),
  "utf8",
)

const MUTATIONS = [
  "createDonationCheckout",
  "requestOrgDonationExport",
  "updateOrgDonationSettings",
  "acceptOrgDonationAgreement",
  "useMutation",
]

describe("the confirmation view never fulfills a donation", () => {
  it("calls no mutation of any kind", () => {
    for (const mutation of MUTATIONS) expect(completeView).not.toContain(mutation)
  })

  it("reads status through exactly one endpoint", () => {
    const calls = [...completeView.matchAll(/api\s*\.\s*(\w+)\(/g)].map((match) => match[1])
    expect([...new Set(calls)]).toEqual(["getDonationStatus"])
  })

  it("marks succeeded only from what the server said, never from the browser", () => {
    expect(completeView).toContain('status.status === "succeeded"')
    expect(completeView).not.toMatch(/setPhase\(\{\s*kind:\s*"settled"[^}]*status:\s*\{/)
  })
})

describe("the checkout commit happens once, before any payment UI", () => {
  it("creates the Checkout Session only from the Continue handler", () => {
    const calls = [...donateView.matchAll(/api\s*\.\s*(\w+)\(/g)].map((match) => match[1])
    expect([...new Set(calls)].sort()).toEqual([
      "createDonationCheckout",
      "getPublicOrgDonationPage",
    ])
  })

  it("guards the commit against a double submit", () => {
    expect(donateView).toContain('if (!canContinue || commit.kind !== "editing"')
  })

  it("never loads Stripe.js before the org DTO resolves READY or AT_RISK", () => {
    expect(donateView).toContain('commit.kind === "committed" ? loadStripeForAccount(')
    const gate = donateView.indexOf('page.donateState === "READY" || page.donateState === "AT_RISK"')
    expect(gate).toBeGreaterThan(-1)
  })
})
