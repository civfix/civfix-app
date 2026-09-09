import { describe, expect, it } from "vitest"
import {
  DONATION_DISCLOSURE_TEMPLATE,
  DONATION_DISCLOSURE_VARS,
  donationDisclosureText,
  fillDonationDisclosure,
  platformFeePercent,
  renderDonationDisclosures,
} from "../donation-disclosure-template.js"

const VARS = {
  orgLegalName: "Reach Out Los Angeles",
  platformFeePercent: "5.00",
  webOrigin: "https://civfix.org",
}

function templateStrings(): string[] {
  const t = DONATION_DISCLOSURE_TEMPLATE
  return [
    t.recipient,
    t.mayNotReceive,
    ...t.mayNotReceiveReasons,
    t.mayNotReceiveUrl,
    t.remittanceTiming,
    t.feePointer,
    t.deductible,
    t.notDeductible,
    t.merchantOfRecord,
    t.defaultRefundPolicy,
  ]
}

describe("donation disclosure template", () => {
  it("uses only declared placeholders", () => {
    const declared = new Set<string>(DONATION_DISCLOSURE_VARS)
    for (const template of templateStrings()) {
      for (const match of template.matchAll(/\{\{([a-zA-Z]+)\}\}/g)) {
        expect(declared.has(match[1] ?? "")).toBe(true)
      }
    }
  })

  it("leaves no placeholder unresolved once filled", () => {
    for (const template of templateStrings()) {
      expect(fillDonationDisclosure(template, VARS)).not.toMatch(/\{\{/)
    }
  })

  it("rejects an unknown placeholder rather than emitting it to a donor", () => {
    expect(() => fillDonationDisclosure("hello {{nope}}", VARS)).toThrow(RangeError)
  })

  it("renders the seven disclosures with the organization's legal name substituted", () => {
    const copy = renderDonationDisclosures(VARS, { deductible: true })
    expect(copy.recipient).toBe(
      "Your donation is made to Reach Out Los Angeles, which receives the funds directly. civfix never holds your money.",
    )
    expect(copy.feePointer).toBe(
      "civfix deducts a 5.00% platform fee, itemized before you pay. The organization pays its own payment-processing fees.",
    )
    expect(copy.merchantOfRecord).toContain("Reach Out Los Angeles is the merchant of record")
    expect(copy.mayNotReceiveUrl).toBe("https://civfix.org/legal/donations#may-not-receive")
    expect(copy.mayNotReceiveReasons).toHaveLength(3)
  })

  it("switches the deductibility sentence on the verdict and never claims a deduction it cannot", () => {
    expect(renderDonationDisclosures(VARS, { deductible: false }).deductibility).toBe(
      "This donation may not be tax deductible. civfix does not provide tax advice.",
    )
    expect(renderDonationDisclosures(VARS, { deductible: true }).deductibility).toContain(
      "tax deductible to the extent allowed by law",
    )
  })

  it("prefers an organization refund policy over the default and falls back on blank", () => {
    expect(
      renderDonationDisclosures(VARS, { deductible: true, refundPolicyText: "We refund anything." })
        .refundPolicy,
    ).toBe("We refund anything.")
    expect(
      renderDonationDisclosures(VARS, { deductible: true, refundPolicyText: "" }).refundPolicy,
    ).toBe(DONATION_DISCLOSURE_TEMPLATE.defaultRefundPolicy)
    expect(
      renderDonationDisclosures(VARS, { deductible: true, refundPolicyText: null }).refundPolicy,
    ).toBe(DONATION_DISCLOSURE_TEMPLATE.defaultRefundPolicy)
  })

  it("never advertises a fee-free donation", () => {
    for (const template of templateStrings()) expect(template).not.toContain("100%")
  })

  it("formats the platform fee from basis points", () => {
    expect(platformFeePercent(500)).toBe("5.00")
    expect(platformFeePercent(0)).toBe("0.00")
  })

  it("exposes the canonical text carrying every template sentence", () => {
    const text = donationDisclosureText()
    for (const template of templateStrings()) expect(text).toContain(template)
  })

  it("is frozen so no consumer can rewrite a disclosure at runtime", () => {
    expect(Object.isFrozen(DONATION_DISCLOSURE_TEMPLATE)).toBe(true)
    expect(Object.isFrozen(DONATION_DISCLOSURE_TEMPLATE.mayNotReceiveReasons)).toBe(true)
  })
})
