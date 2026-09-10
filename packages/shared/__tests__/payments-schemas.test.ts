import { describe, it, expect } from "vitest"
import { ERROR_HTTP_STATUS, ErrorCode, AppError } from "../src/types/errors.js"
import {
  DonateStateSchema,
  DonationDisputeStateSchema,
  DonationStatusSchema,
  EligibilitySourceSchema,
  EligibilityVerdictSchema,
  OrgPaymentsStateSchema,
  PayoutStatusSchema,
} from "../src/schemas/common.js"
import { FeeBreakdownDTOSchema, LegalDocumentVersionDTOSchema } from "../src/schemas/entities.js"
import {
  AcceptOrgDonationAgreementRequestSchema,
  CreateDonationCheckoutRequestSchema,
  CreateOrgPayoutRequestSchema,
  DonationPageDTOSchema,
  GetDonationStatusRequestSchema,
  ListOrgPayoutsRequestSchema,
  ListOrgPayoutsResponseSchema,
  OrgBalanceDTOSchema,
  OrgPaymentsStatusDTOSchema,
  PayoutDTOSchema,
} from "../src/schemas/payments.js"
import { GetLegalVersionsResponseSchema } from "../src/schemas/legal.js"
import { SetOrgDonationsEnabledRequestSchema } from "../src/schemas/admin/payments.js"
import { endpoints } from "../src/client/endpoints.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"
const ISO = "2026-09-01T10:00:00.000Z"

describe("PAYMENT_UNAVAILABLE is the one new error code", () => {
  it("maps to 503 and nothing else moved", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.PAYMENT_UNAVAILABLE]).toBe(503)
    expect(AppError.paymentUnavailable().httpStatus).toBe(503)
    expect(AppError.paymentUnavailable().code).toBe(ErrorCode.PAYMENT_UNAVAILABLE)
    expect(ERROR_HTTP_STATUS[ErrorCode.INTERNAL]).toBe(500)
    expect(ERROR_HTTP_STATUS[ErrorCode.CONFLICT]).toBe(409)
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION]).toBe(422)
  })

  it("adds no PAYMENT_DECLINED / ORG_NOT_ELIGIBLE / AMOUNT_OUT_OF_RANGE code", () => {
    const codes = Object.values(ErrorCode)
    expect(codes).toHaveLength(16)
    expect(codes).not.toContain("PAYMENT_DECLINED")
    expect(codes).not.toContain("ORG_NOT_ELIGIBLE")
    expect(codes).not.toContain("AMOUNT_OUT_OF_RANGE")
  })
})

describe("donation enum tuples", () => {
  it("pins each tuple in mirror order", () => {
    expect([...DonationStatusSchema.options]).toEqual([
      "pending",
      "succeeded",
      "failed",
      "refunded",
      "partially_refunded",
    ])
    expect([...DonationDisputeStateSchema.options]).toEqual([
      "none",
      "open",
      "won",
      "lost",
      "warning",
    ])
    expect([...OrgPaymentsStateSchema.options]).toEqual([
      "not_started",
      "onboarding",
      "ready",
      "at_risk",
      "blocked",
    ])
    expect([...DonateStateSchema.options]).toEqual(["READY", "AT_RISK", "BLOCKED", "OFF"])
    expect([...EligibilityVerdictSchema.options]).toEqual([
      "unknown",
      "eligible",
      "grace",
      "ineligible",
      "review_required",
    ])
    expect([...EligibilitySourceSchema.options]).toEqual([
      "irs_pub78",
      "irs_eo_bmf",
      "irs_auto_revocation",
      "ftb_revoked",
      "ca_ag_mnos",
      "ofac_sdn",
      "central_org_confirmation",
    ])
  })

  it("keeps a dispute out of the monotonic donation status", () => {
    expect(DonationStatusSchema.safeParse("disputed").success).toBe(false)
    expect(DonationDisputeStateSchema.parse("open")).toBe("open")
  })
})

describe("fee breakdown", () => {
  it("is integer minor units with an explicit estimate flag", () => {
    const fees = FeeBreakdownDTOSchema.parse({
      grossMinor: 2500,
      platformFeeMinor: 125,
      processorFeeMinor: 103,
      processorFeeIsEstimate: true,
      netMinor: 2272,
      platformFeeBps: 500,
    })
    expect(fees.currency).toBe("USD")
    expect(fees.processorFeeIsEstimate).toBe(true)
    expect(
      FeeBreakdownDTOSchema.safeParse({
        grossMinor: 25.0,
        platformFeeMinor: 1.25,
        processorFeeMinor: 1.03,
        processorFeeIsEstimate: true,
        netMinor: 22.72,
        platformFeeBps: 500,
      }).success,
    ).toBe(false)
  })

  it("caps the platform fee bps inside the basis-point space", () => {
    const base = {
      grossMinor: 2500,
      platformFeeMinor: 125,
      processorFeeMinor: 103,
      processorFeeIsEstimate: true,
      netMinor: 2272,
    }
    expect(FeeBreakdownDTOSchema.safeParse({ ...base, platformFeeBps: 10001 }).success).toBe(false)
    expect(FeeBreakdownDTOSchema.safeParse({ ...base, platformFeeBps: 0 }).success).toBe(true)
  })
})

describe("donation checkout request", () => {
  const base = {
    orgSlug: "reach-out-la",
    amountMinor: 2500,
    email: "Donor@Example.COM",
    idempotencyKey: "abcd1234efgh",
    consent: {
      termsVersion: "2026-01-01",
      privacyVersion: "2026-01-01",
      donationTermsVersion: "2026-01-01",
      disclosureVersion: "2026-01-01",
      surface: "web_donate" as const,
      screenRoute: "/donate/reach-out-la",
      uiTemplateVersion: "1",
    },
  }

  it("defaults shareIdentity OFF and lowercases the donor email", () => {
    const parsed = CreateDonationCheckoutRequestSchema.parse(base)
    expect(parsed.shareIdentity).toBe(false)
    expect(parsed.email).toBe("donor@example.com")
    expect(parsed.currency).toBe("USD")
  })

  it("refuses a float amount, a zero amount and an unknown key", () => {
    expect(
      CreateDonationCheckoutRequestSchema.safeParse({ ...base, amountMinor: 25.5 }).success,
    ).toBe(false)
    expect(CreateDonationCheckoutRequestSchema.safeParse({ ...base, amountMinor: 0 }).success).toBe(
      false,
    )
    expect(
      CreateDonationCheckoutRequestSchema.safeParse({ ...base, cardNumber: "4242" }).success,
    ).toBe(false)
    expect(
      CreateDonationCheckoutRequestSchema.safeParse({ ...base, acceptedAt: ISO }).success,
    ).toBe(false)
  })

  it("requires the whole consent bundle", () => {
    const { consent, ...withoutConsent } = base
    expect(consent).toBeDefined()
    expect(CreateDonationCheckoutRequestSchema.safeParse(withoutConsent).success).toBe(false)
  })
})

describe("donation page DTO carries everything the donor surface renders", () => {
  const page = {
    org: {
      slug: "reach-out-la",
      displayName: "Reach Out LA",
      legalName: "Reach Out Los Angeles, Inc.",
      verified: true,
    },
    donateState: "READY",
    donationsEnabled: true,
    stripeAccount: "acct_123",
    eligibility: { state: "open" },
    minAmountMinor: 500,
    maxAmountMinor: 1000000,
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
    },
    disclosures: {
      recipient: "Your donation goes to Reach Out Los Angeles, Inc.",
      mayNotReceive: "The organization may not receive the full amount.",
      mayNotReceiveUrl: "https://civfix.org/legal/donations#may-not-receive",
      remittanceTiming: "Funds settle to the organization's account immediately.",
      feePointer: "See the itemized fees above.",
      deductibility: "Contributions are tax deductible to the extent allowed by law.",
      merchantOfRecord:
        "civfix facilitates this payment. Reach Out Los Angeles, Inc. is the merchant of record.",
      refundPolicy: "Donations are non-refundable except as required by law.",
    },
    disclosureVersion: "2026-01-01",
    registrationNumber: "CT0123456",
    taxDeductibility: {
      deductible: true,
      percentage: 100,
      statement: "No goods or services were provided in exchange for this contribution.",
    },
    donorSharing: {
      defaultOn: false,
      optInLabel: "Share my name and email with this organization",
      whatIsShared: "Your name and email address.",
    },
  }

  it("parses with the W4.R-required fields and safe defaults", () => {
    const parsed = DonationPageDTOSchema.parse(page)
    expect(parsed.stripeAccount).toBe("acct_123")
    expect(parsed.donateState).toBe("READY")
    expect(parsed.disclosureVersion).toBe("2026-01-01")
    expect(parsed.registrationNumber).toBe("CT0123456")
    expect(parsed.walletsAvailable).toEqual([])
    expect(parsed.legalVersions).toEqual([])
    expect(parsed.currency).toBe("USD")
    expect(parsed.requiresTurnstile).toBe(true)
  })

  it("never says a donation is 100% of the gift", () => {
    const parsed = DonationPageDTOSchema.parse(page)
    const text = Object.values(parsed.disclosures).join(" ")
    expect(text).not.toContain("100%")
  })

  it("keeps donor sharing default-off as a literal, not a settable flag", () => {
    expect(
      DonationPageDTOSchema.safeParse({
        ...page,
        donorSharing: { ...page.donorSharing, defaultOn: true },
      }).success,
    ).toBe(false)
  })
})

describe("org payments status", () => {
  it("parses a not-started org with empty requirement lists", () => {
    const parsed = OrgPaymentsStatusDTOSchema.parse({
      organizationId: UUID,
      state: "not_started",
      stripeAccountId: null,
      agreement: { version: null },
      eligibility: { verdict: "unknown" },
      donateState: "OFF",
    })
    expect(parsed.currentlyDue).toEqual([])
    expect(parsed.chargesEnabled).toBe(false)
    expect(parsed.donationsEnabled).toBe(false)
    expect(parsed.agreement.current).toBe(false)
    expect(parsed.eligibility.checks).toEqual([])
  })
})

describe("consent and operator actions require an explicit record", () => {
  it("requires an affirmative authority declaration on the §318 agreement", () => {
    const base = { id: UUID, version: "2026-01-01" }
    expect(AcceptOrgDonationAgreementRequestSchema.safeParse(base).success).toBe(false)
    const ok = AcceptOrgDonationAgreementRequestSchema.safeParse({
      ...base,
      authorityAffirmed: true,
    })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.surface).toBe("web_org_settings")
    expect(
      AcceptOrgDonationAgreementRequestSchema.safeParse({ ...base, authorityAffirmed: false })
        .success,
    ).toBe(false)
  })

  it("requires a reason before an operator can flip an org's donations", () => {
    expect(
      SetOrgDonationsEnabledRequestSchema.safeParse({ id: UUID, enabled: false }).success,
    ).toBe(false)
    expect(
      SetOrgDonationsEnabledRequestSchema.safeParse({ id: UUID, enabled: false, reason: "" })
        .success,
    ).toBe(false)
    expect(
      SetOrgDonationsEnabledRequestSchema.safeParse({
        id: UUID,
        enabled: false,
        reason: "AG registry lapsed",
      }).success,
    ).toBe(true)
  })

  it("lets a guest read a donation status with a capability token and nothing else", () => {
    expect(GetDonationStatusRequestSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(GetDonationStatusRequestSchema.safeParse({ id: UUID, token: "t".repeat(24) }).success).toBe(
      true,
    )
    expect(
      GetDonationStatusRequestSchema.safeParse({ id: UUID, email: "a@b.com" }).success,
    ).toBe(false)
  })
})

describe("legal versions", () => {
  it("shapes a document version as type + version + hash + effective date + url", () => {
    const doc = LegalDocumentVersionDTOSchema.parse({
      type: "donations",
      version: "2026-01-01",
      sha256: "a".repeat(64),
      effectiveAt: ISO,
      url: "https://civfix.org/legal/donations",
    })
    expect(doc.type).toBe("donations")
    expect(
      GetLegalVersionsResponseSchema.parse({ documents: [doc], generatedAt: ISO }).documents,
    ).toHaveLength(1)
  })
})

describe("org balance and payouts (0.43.0)", () => {
  const money = { amountMinor: 12500, currency: "USD" }

  it("keeps PayoutStatus in Stripe's own order", () => {
    expect([...PayoutStatusSchema.options]).toEqual([
      "pending",
      "in_transit",
      "paid",
      "failed",
      "canceled",
    ])
  })

  it("round-trips a payout row and tolerates an unscheduled arrival", () => {
    const payout = {
      id: UUID,
      stripePayoutId: "po_1",
      amount: money,
      status: "pending",
      createdAt: ISO,
    }
    const parsed = PayoutDTOSchema.parse(payout)
    expect(parsed.arrivalDate).toBeUndefined()
    expect(parsed.failureMessage).toBeUndefined()
    expect(
      PayoutDTOSchema.safeParse({
        ...payout,
        status: "failed",
        arrivalDate: null,
        failureMessage: "Account closed",
      }).success,
    ).toBe(true)
    expect(PayoutDTOSchema.safeParse({ ...payout, status: "settled" }).success).toBe(false)
  })

  it("carries the schedule with the balance so the client can explain a disabled button", () => {
    const balance = {
      available: money,
      pending: { amountMinor: 0, currency: "USD" },
      payoutsEnabled: true,
      payoutSchedule: { interval: "daily", delayDays: 2 },
      lastSyncedAt: ISO,
    }
    expect(OrgBalanceDTOSchema.parse(balance).payoutSchedule?.interval).toBe("daily")
    expect(OrgBalanceDTOSchema.safeParse({ ...balance, payoutSchedule: null }).success).toBe(true)
    expect(
      OrgBalanceDTOSchema.parse({ ...balance, payoutsEnabled: undefined }).payoutsEnabled,
    ).toBe(false)
    expect(
      OrgBalanceDTOSchema.safeParse({ ...balance, payoutSchedule: { interval: "hourly" } }).success,
    ).toBe(false)
    expect(OrgBalanceDTOSchema.safeParse({ ...balance, lastSyncedAt: undefined }).success).toBe(
      false,
    )
  })

  it("requires an idempotency key and treats an absent amount as the whole balance", () => {
    expect(
      CreateOrgPayoutRequestSchema.parse({ id: UUID, idempotencyKey: UUID }),
    ).toEqual({ id: UUID, currency: "USD", idempotencyKey: UUID })
    expect(CreateOrgPayoutRequestSchema.safeParse({ id: UUID }).success).toBe(false)
    expect(
      CreateOrgPayoutRequestSchema.safeParse({ id: UUID, idempotencyKey: "not-a-uuid" }).success,
    ).toBe(false)
    expect(
      CreateOrgPayoutRequestSchema.safeParse({ id: UUID, idempotencyKey: UUID, amountMinor: 0 })
        .success,
    ).toBe(false)
    expect(
      CreateOrgPayoutRequestSchema.safeParse({ id: UUID, idempotencyKey: UUID, currency: "EUR" })
        .success,
    ).toBe(false)
    expect(
      CreateOrgPayoutRequestSchema.safeParse({ id: UUID, idempotencyKey: UUID, extra: 1 }).success,
    ).toBe(false)
  })

  it("pages payouts like every other org list", () => {
    expect(ListOrgPayoutsRequestSchema.parse({ id: UUID, limit: "10" })).toEqual({
      id: UUID,
      limit: 10,
    })
    expect(ListOrgPayoutsRequestSchema.safeParse({ id: UUID, limit: 51 }).success).toBe(false)
    expect(ListOrgPayoutsResponseSchema.safeParse({ items: [], nextCursor: null }).success).toBe(
      true,
    )
  })

  it("registers the three payout endpoints under /orgs/:id/payments", () => {
    expect(endpoints.getOrgBalance.path).toBe("/orgs/:id/payments/balance")
    expect(endpoints.getOrgBalance.method).toBe("GET")
    expect(endpoints.getOrgBalance.csrf).toBe(false)
    expect(endpoints.createOrgPayout.path).toBe("/orgs/:id/payments/payouts")
    expect(endpoints.createOrgPayout.method).toBe("POST")
    expect(endpoints.createOrgPayout.csrf).toBe(true)
    expect(endpoints.listOrgPayouts.path).toBe("/orgs/:id/payments/payouts")
    expect(endpoints.listOrgPayouts.method).toBe("GET")
    expect(endpoints.listOrgPayouts.auth).toBe("required")
  })
})
