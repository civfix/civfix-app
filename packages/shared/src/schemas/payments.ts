import { z } from "zod"
import {
  ConsentSurfaceSchema,
  DonateStateSchema,
  DonationDisputeStateSchema,
  DonationStatusSchema,
  EligibilitySourceSchema,
  EligibilityVerdictSchema,
  IdSchema,
  ISODateSchema,
  OrgPaymentsStateSchema,
  PaginationQuerySchema,
  pageResponse,
} from "./common.js"
import {
  DonationDTOSchema,
  FeeBreakdownDTOSchema,
  LegalDocumentVersionDTOSchema,
  MoneyDTOSchema,
} from "./entities.js"
import { HostExportDTOSchema, HostExportFiltersSchema } from "./host/exports.js"
import { OrgSlugSchema } from "./host/organizations.js"


export {
  DonationDTOSchema,
  FeeBreakdownDTOSchema,
  MoneyDTOSchema,
  LegalDocumentVersionDTOSchema,
} from "./entities.js"
export type {
  DonationDTO,
  FeeBreakdownDTO,
  MoneyDTO,
  LegalDocumentVersionDTO,
} from "./entities.js"
export {
  DonateStateSchema,
  DonationDisputeStateSchema,
  DonationStatusSchema,
  EligibilitySourceSchema,
  EligibilityVerdictSchema,
  OrgPaymentsStateSchema,
} from "./common.js"
export type {
  DonateState,
  DonationDisputeState,
  DonationStatus,
  EligibilitySource,
  EligibilityVerdict,
  OrgPaymentsState,
} from "./common.js"

export const DONATION_CURRENCY = "USD" as const
export const MAX_DONOR_NAME = 120
export const MAX_REFUND_POLICY_TEXT = 500
export const MAX_MISSION_BLURB = 280
export const MAX_SUGGESTED_AMOUNTS = 6

export const DonorEmailSchema = z.string().trim().email().max(254).toLowerCase()

export const AmountMinorSchema = z.number().int().positive().max(100_000_000)

const OrgEligibilityCheckDTOObjectSchema = z.object({
  source: EligibilitySourceSchema,
  sourceRevisionDate: z.string(),
  matched: z.boolean(),
  verdictContribution: z.enum(["supports", "disqualifies", "neutral"]),
  detail: z.string().nullable().optional(),
  checkedAt: ISODateSchema,
})
export type OrgEligibilityCheckDTO = z.infer<typeof OrgEligibilityCheckDTOObjectSchema>
export const OrgEligibilityCheckDTOSchema: z.ZodType<OrgEligibilityCheckDTO, z.ZodTypeDef, unknown> =
  OrgEligibilityCheckDTOObjectSchema

const OrgEligibilityDTOObjectSchema = z.object({
  verdict: EligibilityVerdictSchema,
  reasons: z.array(z.string()).default([]),
  einLast4: z.string().nullable().optional(),
  irsLegalName: z.string().nullable().optional(),
  deductibilityCode: z.string().nullable().optional(),
  foundationCode: z.string().nullable().optional(),
  graceExpiresAt: ISODateSchema.nullable().optional(),
  evaluatedAt: ISODateSchema.nullable().optional(),
  nextCheckAt: ISODateSchema.nullable().optional(),
  checks: z.array(OrgEligibilityCheckDTOSchema).default([]),
})
export type OrgEligibilityDTO = z.infer<typeof OrgEligibilityDTOObjectSchema>
export const OrgEligibilityDTOSchema: z.ZodType<OrgEligibilityDTO, z.ZodTypeDef, unknown> =
  OrgEligibilityDTOObjectSchema

export const OrgPaymentMethodDomainSchema = z.object({
  domain: z.string(),
  enabled: z.boolean(),
  registeredAt: ISODateSchema.nullable().optional(),
})
export type OrgPaymentMethodDomain = z.infer<typeof OrgPaymentMethodDomainSchema>

const OrgDonationAgreementDTOObjectSchema = z.object({
  version: z.string().nullable(),
  acceptedAt: ISODateSchema.nullable().optional(),
  acceptedByName: z.string().nullable().optional(),
  current: z.boolean().default(false),
  requiredVersion: z.string().nullable().optional(),
})
export type OrgDonationAgreementDTO = z.infer<typeof OrgDonationAgreementDTOObjectSchema>
export const OrgDonationAgreementDTOSchema: z.ZodType<OrgDonationAgreementDTO, z.ZodTypeDef, unknown> =
  OrgDonationAgreementDTOObjectSchema

const OrgPaymentsStatusObjectSchema = z.object({
  organizationId: IdSchema,
  state: OrgPaymentsStateSchema,
  stripeAccountId: z.string().nullable(),
  livemode: z.boolean().default(false),
  detailsSubmitted: z.boolean().default(false),
  chargesEnabled: z.boolean().default(false),
  payoutsEnabled: z.boolean().default(false),
  disabledReason: z.string().nullable().optional(),
  currentlyDue: z.array(z.string()).default([]),
  pastDue: z.array(z.string()).default([]),
  pendingVerification: z.array(z.string()).default([]),
  futureCurrentlyDue: z.array(z.string()).default([]),
  currentDeadline: ISODateSchema.nullable().optional(),
  capabilities: z.record(z.string()).default({}),
  paymentMethodDomains: z.array(OrgPaymentMethodDomainSchema).default([]),
  walletsAvailable: z.array(z.string()).default([]),
  donationsEnabled: z.boolean().default(false),
  donationsDisabledReason: z
    .enum(["org", "operator", "eligibility", "stripe_blocked", "deauthorized"])
    .nullable()
    .optional(),
  agreement: OrgDonationAgreementDTOSchema,
  eligibility: OrgEligibilityDTOSchema,
  donateState: DonateStateSchema,
  lastSyncedAt: ISODateSchema.nullable().optional(),
})
export type OrgPaymentsStatusDTO = z.infer<typeof OrgPaymentsStatusObjectSchema>

export const OrgPaymentsStatusDTOSchema: z.ZodType<OrgPaymentsStatusDTO, z.ZodTypeDef, unknown> =
  OrgPaymentsStatusObjectSchema

export const CreateOrgStripeAccountRequestSchema = z.object({ id: IdSchema }).strict()
export type CreateOrgStripeAccountRequest = z.infer<typeof CreateOrgStripeAccountRequestSchema>

export const CreateOrgStripeAccountResponseSchema = OrgPaymentsStatusDTOSchema
export type CreateOrgStripeAccountResponse = z.infer<typeof CreateOrgStripeAccountResponseSchema>

export const CreateOrgStripeAccountLinkRequestSchema = z
  .object({ id: IdSchema, type: z.enum(["onboarding", "update"]).default("onboarding") })
  .strict()
export type CreateOrgStripeAccountLinkRequest = z.infer<
  typeof CreateOrgStripeAccountLinkRequestSchema
>

export const CreateOrgStripeAccountLinkResponseSchema = z.object({
  url: z.string(),
  expiresAt: ISODateSchema,
})
export type CreateOrgStripeAccountLinkResponse = z.infer<
  typeof CreateOrgStripeAccountLinkResponseSchema
>

export const GetOrgPaymentsStatusRequestSchema = z.object({ id: IdSchema }).strict()
export type GetOrgPaymentsStatusRequest = z.infer<typeof GetOrgPaymentsStatusRequestSchema>

export const GetOrgPaymentsStatusResponseSchema = OrgPaymentsStatusDTOSchema
export type GetOrgPaymentsStatusResponse = z.infer<typeof GetOrgPaymentsStatusResponseSchema>

const OrgDonationSettingsDTOObjectSchema = z.object({
  organizationId: IdSchema,
  enabled: z.boolean(),
  donorSharingDefault: z.boolean().default(false),
  missionBlurb: z.string().max(MAX_MISSION_BLURB).nullable().optional(),
  designationNote: z.string().max(MAX_MISSION_BLURB).nullable().optional(),
  refundPolicyText: z.string().max(MAX_REFUND_POLICY_TEXT).nullable().optional(),
  minAmountMinor: z.number().int().nonnegative(),
  maxAmountMinor: z.number().int().nonnegative(),
  suggestedAmountsMinor: z.array(z.number().int().positive()).max(MAX_SUGGESTED_AMOUNTS).default([]),
  agreedFeeBps: z.number().int().min(0).max(2000),
  effectiveFeeBps: z.number().int().min(0).max(2000),
  legalName: z.string().nullable().optional(),
  einLast4: z.string().nullable().optional(),
  agreement: OrgDonationAgreementDTOSchema,
  eligibility: OrgEligibilityDTOSchema,
  donateState: DonateStateSchema,
})
export type OrgDonationSettingsDTO = z.infer<typeof OrgDonationSettingsDTOObjectSchema>
export const OrgDonationSettingsDTOSchema: z.ZodType<OrgDonationSettingsDTO, z.ZodTypeDef, unknown> =
  OrgDonationSettingsDTOObjectSchema

export const GetOrgDonationSettingsRequestSchema = z.object({ id: IdSchema }).strict()
export type GetOrgDonationSettingsRequest = z.infer<typeof GetOrgDonationSettingsRequestSchema>

export const GetOrgDonationSettingsResponseSchema = OrgDonationSettingsDTOSchema
export type GetOrgDonationSettingsResponse = z.infer<typeof GetOrgDonationSettingsResponseSchema>

export const UpdateOrgDonationSettingsRequestSchema = z
  .object({
    id: IdSchema,
    enabled: z.boolean().optional(),
    donorSharingDefault: z.boolean().optional(),
    missionBlurb: z.string().max(MAX_MISSION_BLURB).nullable().optional(),
    designationNote: z.string().max(MAX_MISSION_BLURB).nullable().optional(),
    refundPolicyText: z.string().max(MAX_REFUND_POLICY_TEXT).nullable().optional(),
    minAmountMinor: z.number().int().positive().optional(),
    maxAmountMinor: z.number().int().positive().optional(),
    suggestedAmountsMinor: z
      .array(z.number().int().positive())
      .max(MAX_SUGGESTED_AMOUNTS)
      .optional(),
  })
  .strict()
export type UpdateOrgDonationSettingsRequest = z.infer<
  typeof UpdateOrgDonationSettingsRequestSchema
>

export const UpdateOrgDonationSettingsResponseSchema = OrgDonationSettingsDTOSchema
export type UpdateOrgDonationSettingsResponse = z.infer<
  typeof UpdateOrgDonationSettingsResponseSchema
>

export const AcceptOrgDonationAgreementRequestSchema = z
  .object({
    id: IdSchema,
    version: z.string().min(1).max(32),
    documentSha256: z.string().min(1).max(128).optional(),
    surface: ConsentSurfaceSchema.default("web_org_settings"),
    screenRoute: z.string().max(200).optional(),
    uiTemplateVersion: z.string().max(32).optional(),
    authorityAffirmed: z.literal(true),
  })
  .strict()
export type AcceptOrgDonationAgreementRequest = z.infer<
  typeof AcceptOrgDonationAgreementRequestSchema
>

export const AcceptOrgDonationAgreementResponseSchema = z.object({
  ok: z.literal(true),
  agreement: OrgDonationAgreementDTOSchema,
})
export type AcceptOrgDonationAgreementResponse = z.infer<
  typeof AcceptOrgDonationAgreementResponseSchema
>

export const DonationDisclosuresSchema = z.object({
  recipient: z.string(),
  mayNotReceive: z.string(),
  mayNotReceiveUrl: z.string(),
  mayNotReceiveReasons: z.array(z.string()).default([]),
  remittanceTiming: z.string(),
  feePointer: z.string(),
  deductibility: z.string(),
  deductibilityCheckedAt: ISODateSchema.nullable().optional(),
  merchantOfRecord: z.string(),
  refundPolicy: z.string(),
})
export type DonationDisclosures = z.infer<typeof DonationDisclosuresSchema>

export const DonationTaxDeductibilitySchema = z.object({
  deductible: z.boolean(),
  percentage: z.number().min(0).max(100).nullable(),
  statement: z.string(),
  checkedAt: ISODateSchema.nullable().optional(),
})
export type DonationTaxDeductibility = z.infer<typeof DonationTaxDeductibilitySchema>

export const DonorSharingPolicySchema = z.object({
  defaultOn: z.literal(false),
  optInLabel: z.string(),
  whatIsShared: z.string(),
})
export type DonorSharingPolicy = z.infer<typeof DonorSharingPolicySchema>

export const DonationPageOrgSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  legalName: z.string(),
  logoUrl: z.string().nullable().optional(),
  verified: z.boolean(),
  einLast4: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
})
export type DonationPageOrg = z.infer<typeof DonationPageOrgSchema>

export const DonationPageEventRefSchema = z.object({
  id: IdSchema,
  title: z.string(),
  startsAt: ISODateSchema,
})
export type DonationPageEventRef = z.infer<typeof DonationPageEventRefSchema>

const DonationPageObjectSchema = z.object({
  org: DonationPageOrgSchema,
  donateState: DonateStateSchema,
  donationsEnabled: z.boolean(),
  stripeAccount: z.string().nullable(),
  eligibility: z.object({
    state: z.enum(["open", "closed"]),
    closedReason: z.string().nullable().optional(),
  }),
  currency: z.literal("USD").default("USD"),
  minAmountMinor: z.number().int().positive(),
  maxAmountMinor: z.number().int().positive(),
  suggestedAmountsMinor: z.array(z.number().int().positive()).default([]),
  platformFeeBps: z.number().int().min(0).max(2000),
  processingFeeBps: z.number().int().min(0).max(2000),
  processingFeeFixedMinor: z.number().int().nonnegative(),
  feePreview: FeeBreakdownDTOSchema,
  disclosures: DonationDisclosuresSchema,
  disclosureVersion: z.string(),
  registrationNumber: z.string().nullable(),
  taxDeductibility: DonationTaxDeductibilitySchema,
  donorSharing: DonorSharingPolicySchema,
  legalVersions: z.array(LegalDocumentVersionDTOSchema).default([]),
  walletsAvailable: z.array(z.string()).default([]),
  requiresTurnstile: z.boolean().default(true),
  event: DonationPageEventRefSchema.nullable().optional(),
})
export type DonationPageDTO = z.infer<typeof DonationPageObjectSchema>

export const DonationPageDTOSchema: z.ZodType<DonationPageDTO, z.ZodTypeDef, unknown> =
  DonationPageObjectSchema

export const GetPublicOrgDonationPageRequestSchema = z.object({ slug: OrgSlugSchema }).strict()
export type GetPublicOrgDonationPageRequest = z.infer<typeof GetPublicOrgDonationPageRequestSchema>

export const GetPublicOrgDonationPageResponseSchema = DonationPageDTOSchema
export type GetPublicOrgDonationPageResponse = z.infer<
  typeof GetPublicOrgDonationPageResponseSchema
>

export const DonationConsentInputSchema = z
  .object({
    termsVersion: z.string().min(1).max(32),
    privacyVersion: z.string().min(1).max(32),
    donationTermsVersion: z.string().min(1).max(32),
    disclosureVersion: z.string().min(1).max(32),
    surface: ConsentSurfaceSchema,
    screenRoute: z.string().max(200),
    uiTemplateVersion: z.string().max(32),
  })
  .strict()
export type DonationConsentInput = z.infer<typeof DonationConsentInputSchema>

export const CreateDonationCheckoutRequestSchema = z
  .object({
    orgSlug: OrgSlugSchema,
    amountMinor: AmountMinorSchema,
    currency: z.literal("USD").default("USD"),
    email: DonorEmailSchema,
    name: z.string().trim().max(MAX_DONOR_NAME).optional(),
    eventId: IdSchema.optional(),
    shareIdentity: z.boolean().default(false),
    consent: DonationConsentInputSchema,
    idempotencyKey: z.string().min(8).max(128),
    turnstileToken: z.string().min(1).max(2048).optional(),
  })
  .strict()
export type CreateDonationCheckoutRequest = z.infer<typeof CreateDonationCheckoutRequestSchema>

const CreateDonationCheckoutResponseObjectSchema = z.object({
  donationId: IdSchema,
  clientSecret: z.string(),
  stripeAccount: z.string(),
  statusToken: z.string(),
  returnUrl: z.string(),
  expiresAt: ISODateSchema,
  feeBreakdown: FeeBreakdownDTOSchema,
})
export type CreateDonationCheckoutResponse = z.infer<typeof CreateDonationCheckoutResponseObjectSchema>
export const CreateDonationCheckoutResponseSchema: z.ZodType<CreateDonationCheckoutResponse, z.ZodTypeDef, unknown> =
  CreateDonationCheckoutResponseObjectSchema

export const GetDonationStatusRequestSchema = z
  .object({
    id: IdSchema,
    token: z.string().min(16).max(512).optional(),
    sessionId: z.string().min(1).max(255).optional(),
  })
  .strict()
export type GetDonationStatusRequest = z.infer<typeof GetDonationStatusRequestSchema>

const DonationStatusDTOObjectSchema = z.object({
  status: DonationStatusSchema,
  amount: MoneyDTOSchema,
  orgLegalName: z.string(),
  maskedEmail: z.string().nullable(),
  reference: z.string(),
  chargedAt: ISODateSchema.nullable(),
  receiptSent: z.boolean().default(false),
})
export type DonationStatusDTO = z.infer<typeof DonationStatusDTOObjectSchema>
export const DonationStatusDTOSchema: z.ZodType<DonationStatusDTO, z.ZodTypeDef, unknown> =
  DonationStatusDTOObjectSchema

export const GetDonationStatusResponseSchema = DonationStatusDTOSchema
export type GetDonationStatusResponse = z.infer<typeof GetDonationStatusResponseSchema>

export const ListMyDonationsRequestSchema = PaginationQuerySchema.strict()
export type ListMyDonationsRequest = z.infer<typeof ListMyDonationsRequestSchema>

const ListMyDonationsResponseObjectSchema = pageResponse(DonationDTOSchema)
export type ListMyDonationsResponse = z.infer<typeof ListMyDonationsResponseObjectSchema>
export const ListMyDonationsResponseSchema: z.ZodType<ListMyDonationsResponse, z.ZodTypeDef, unknown> =
  ListMyDonationsResponseObjectSchema

export const GetMyDonationReceiptRequestSchema = z.object({ id: IdSchema }).strict()
export type GetMyDonationReceiptRequest = z.infer<typeof GetMyDonationReceiptRequestSchema>

const GetMyDonationReceiptResponseObjectSchema = z.object({
  url: z.string(),
  expiresAt: ISODateSchema,
  filename: z.string(),
})
export type GetMyDonationReceiptResponse = z.infer<typeof GetMyDonationReceiptResponseObjectSchema>
export const GetMyDonationReceiptResponseSchema: z.ZodType<GetMyDonationReceiptResponse, z.ZodTypeDef, unknown> =
  GetMyDonationReceiptResponseObjectSchema

const OrgDonationRowDTOObjectSchema = z.object({
  id: IdSchema,
  reference: z.string(),
  amount: MoneyDTOSchema,
  platformFeeMinor: z.number().int().nonnegative(),
  processorFeeMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  status: DonationStatusSchema,
  disputeState: DonationDisputeStateSchema.default("none"),
  refundedTotalMinor: z.number().int().nonnegative().default(0),
  chargedAt: ISODateSchema.nullable(),
  donorName: z.string().nullable(),
  donorEmail: z.string().nullable(),
  sharedIdentity: z.boolean().default(false),
  eventId: IdSchema.nullable().optional(),
  eventTitle: z.string().nullable().optional(),
  receiptSentAt: ISODateSchema.nullable().optional(),
})
export type OrgDonationRowDTO = z.infer<typeof OrgDonationRowDTOObjectSchema>
export const OrgDonationRowDTOSchema: z.ZodType<OrgDonationRowDTO, z.ZodTypeDef, unknown> =
  OrgDonationRowDTOObjectSchema

export const ListOrgDonationsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  status: DonationStatusSchema.optional(),
  from: ISODateSchema.optional(),
  to: ISODateSchema.optional(),
}).strict()
export type ListOrgDonationsRequest = z.infer<typeof ListOrgDonationsRequestSchema>

const ListOrgDonationsResponseObjectSchema = pageResponse(OrgDonationRowDTOSchema)
export type ListOrgDonationsResponse = z.infer<typeof ListOrgDonationsResponseObjectSchema>
export const ListOrgDonationsResponseSchema: z.ZodType<ListOrgDonationsResponse, z.ZodTypeDef, unknown> =
  ListOrgDonationsResponseObjectSchema

export const GetOrgDonationSummaryRequestSchema = z
  .object({ id: IdSchema, from: ISODateSchema.optional(), to: ISODateSchema.optional() })
  .strict()
export type GetOrgDonationSummaryRequest = z.infer<typeof GetOrgDonationSummaryRequestSchema>

const OrgDonationSummaryDTOObjectSchema = z.object({
  currency: z.literal("USD").default("USD"),
  donationCount: z.number().int().nonnegative(),
  grossMinor: z.number().int().nonnegative(),
  platformFeeMinor: z.number().int().nonnegative(),
  processorFeeMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  refundedMinor: z.number().int().nonnegative(),
  disputedCount: z.number().int().nonnegative(),
  from: ISODateSchema.nullable().optional(),
  to: ISODateSchema.nullable().optional(),
})
export type OrgDonationSummaryDTO = z.infer<typeof OrgDonationSummaryDTOObjectSchema>
export const OrgDonationSummaryDTOSchema: z.ZodType<OrgDonationSummaryDTO, z.ZodTypeDef, unknown> =
  OrgDonationSummaryDTOObjectSchema

export const GetOrgDonationSummaryResponseSchema = OrgDonationSummaryDTOSchema
export type GetOrgDonationSummaryResponse = z.infer<typeof GetOrgDonationSummaryResponseSchema>

export const RequestOrgDonationExportRequestSchema = z
  .object({ id: IdSchema, filters: HostExportFiltersSchema.optional() })
  .strict()
export type RequestOrgDonationExportRequest = z.infer<typeof RequestOrgDonationExportRequestSchema>

export const RequestOrgDonationExportResponseSchema = HostExportDTOSchema
export type RequestOrgDonationExportResponse = z.infer<
  typeof RequestOrgDonationExportResponseSchema
>
