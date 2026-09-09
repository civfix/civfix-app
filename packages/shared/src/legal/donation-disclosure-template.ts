export const DONATION_DISCLOSURE_IDS = [
  "recipient",
  "mayNotReceive",
  "remittanceTiming",
  "feePointer",
  "deductibility",
  "merchantOfRecord",
  "refundPolicy",
] as const

export type DonationDisclosureId = (typeof DONATION_DISCLOSURE_IDS)[number]

export interface DonationDisclosureVars {
  orgLegalName: string
  platformFeePercent: string
  webOrigin: string
}

export const DONATION_DISCLOSURE_VARS = [
  "orgLegalName",
  "platformFeePercent",
  "webOrigin",
] as const

export const DONATION_DISCLOSURE_TEMPLATE = Object.freeze({
  recipient:
    "Your donation is made to {{orgLegalName}}, which receives the funds directly. civfix never holds your money.",
  mayNotReceive:
    "There are limited circumstances in which this organization may not receive your donation.",
  mayNotReceiveReasons: Object.freeze([
    "The organization is removed from our platform or loses its good standing before the funds are delivered.",
    "The organization's account with our payment processor stops accepting payments.",
    "Your payment is reversed, refunded or successfully disputed.",
  ]) as readonly string[],
  mayNotReceiveUrl: "{{webOrigin}}/legal/donations#may-not-receive",
  remittanceTiming:
    "Funds settle to the organization's own payment account, normally within a few business days of your gift and no later than 30 days.",
  feePointer:
    "civfix deducts a {{platformFeePercent}}% platform fee, itemized before you pay. The organization pays its own payment-processing fees.",
  deductible:
    "{{orgLegalName}} states that donations are tax deductible to the extent allowed by law. civfix does not provide tax advice.",
  notDeductible: "This donation may not be tax deductible. civfix does not provide tax advice.",
  merchantOfRecord:
    "{{orgLegalName}} is the merchant of record for this payment. civfix is a facilitator and is not the organizer of any event.",
  defaultRefundPolicy:
    "Donations are generally non-refundable. The organization may refund a gift at its discretion; where it does, civfix refunds its platform fee proportionally. Payment-processing fees are not returned.",
})

const PLACEHOLDER = /\{\{([a-zA-Z]+)\}\}/g

export function fillDonationDisclosure(template: string, vars: DonationDisclosureVars): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = (vars as unknown as Record<string, string | undefined>)[name]
    if (typeof value !== "string") {
      throw new RangeError(`unknown donation disclosure placeholder "${name}"`)
    }
    return value
  })
}

export interface DonationDisclosureCopy {
  recipient: string
  mayNotReceive: string
  mayNotReceiveReasons: string[]
  mayNotReceiveUrl: string
  remittanceTiming: string
  feePointer: string
  deductibility: string
  merchantOfRecord: string
  refundPolicy: string
}

export function renderDonationDisclosures(
  vars: DonationDisclosureVars,
  options: { deductible: boolean; refundPolicyText?: string | null },
): DonationDisclosureCopy {
  const fill = (template: string) => fillDonationDisclosure(template, vars)
  const refundPolicyText = options.refundPolicyText ?? null
  return {
    recipient: fill(DONATION_DISCLOSURE_TEMPLATE.recipient),
    mayNotReceive: fill(DONATION_DISCLOSURE_TEMPLATE.mayNotReceive),
    mayNotReceiveReasons: DONATION_DISCLOSURE_TEMPLATE.mayNotReceiveReasons.map(fill),
    mayNotReceiveUrl: fill(DONATION_DISCLOSURE_TEMPLATE.mayNotReceiveUrl),
    remittanceTiming: fill(DONATION_DISCLOSURE_TEMPLATE.remittanceTiming),
    feePointer: fill(DONATION_DISCLOSURE_TEMPLATE.feePointer),
    deductibility: fill(
      options.deductible
        ? DONATION_DISCLOSURE_TEMPLATE.deductible
        : DONATION_DISCLOSURE_TEMPLATE.notDeductible,
    ),
    merchantOfRecord: fill(DONATION_DISCLOSURE_TEMPLATE.merchantOfRecord),
    refundPolicy:
      refundPolicyText !== null && refundPolicyText.length > 0
        ? refundPolicyText
        : fill(DONATION_DISCLOSURE_TEMPLATE.defaultRefundPolicy),
  }
}

export function platformFeePercent(feeBps: number): string {
  return (feeBps / 100).toFixed(2)
}

export function donationDisclosureText(): string {
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
  ].join("\n")
}
