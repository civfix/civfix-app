import type { GetPublicOrgDonationPageResponse } from "@civfix/shared"

export const PAGE: GetPublicOrgDonationPageResponse = {
  org: {
    slug: "reach-out-la",
    displayName: "Reach Out LA",
    legalName: "Reach Out Los Angeles",
    logoUrl: null,
    verified: true,
    einLast4: "1234",
    city: "Los Angeles",
    state: "CA",
  },
  donateState: "READY",
  donationsEnabled: true,
  stripeAccount: "acct_1",
  eligibility: { state: "open", closedReason: null },
  currency: "USD",
  minAmountMinor: 500,
  maxAmountMinor: 1_000_000,
  suggestedAmountsMinor: [1000, 2500, 5000, 10000],
  platformFeeBps: 500,
  processingFeeBps: 290,
  processingFeeFixedMinor: 30,
  feePreview: {
    grossMinor: 2500,
    platformFeeMinor: 125,
    processorFeeMinor: 103,
    processorFeeIsEstimate: true,
    netMinor: 2272,
    platformFeeBps: 500,
    currency: "USD",
  },
  disclosures: {
    recipient: "Your donation is made to Reach Out Los Angeles.",
    mayNotReceive:
      "In rare cases Reach Out Los Angeles may not receive your donation; if that happens we refund you.",
    mayNotReceiveUrl: "/legal/donations#may-not-receive",
    mayNotReceiveReasons: ["The organization loses its tax-exempt status."],
    remittanceTiming:
      "Funds settle directly into the organization's own account as the payment clears.",
    feePointer: "civfix charges a 5% platform fee; the organization pays the card processing fee.",
    deductibility: "Donations to this organization are tax-deductible to the extent allowed by law.",
    deductibilityCheckedAt: "2026-08-01T00:00:00.000Z",
    merchantOfRecord:
      "civfix facilitates this payment. Reach Out Los Angeles is the merchant of record.",
    refundPolicy: "Donations are non-refundable except where the law or the organization allows.",
  },
  disclosureVersion: "2026-09-06",
  registrationNumber: null,
  taxDeductibility: {
    deductible: true,
    percentage: 100,
    statement: "Tax-deductible to the extent allowed by law.",
    checkedAt: "2026-08-01T00:00:00.000Z",
  },
  donorSharing: {
    defaultOn: false,
    optInLabel: "Share my name and email with Reach Out Los Angeles",
    whatIsShared: "Only your name and email address are shared, and only if you check this box.",
  },
  legalVersions: [],
  walletsAvailable: [],
  requiresTurnstile: false,
  event: null,
}

export const CHECKOUT = {
  donationId: "don_1",
  clientSecret: "cs_secret",
  stripeAccount: "acct_1",
  statusToken: "tok_status_value_long_enough",
  returnUrl: "https://civfix.org/donate/reach-out-la/complete?donation=don_1&t=tok",
  expiresAt: "2026-09-06T01:00:00.000Z",
  feeBreakdown: {
    grossMinor: 2500,
    platformFeeMinor: 125,
    processorFeeMinor: 103,
    processorFeeIsEstimate: true,
    netMinor: 2272,
    platformFeeBps: 500,
    currency: "USD" as const,
  },
}

