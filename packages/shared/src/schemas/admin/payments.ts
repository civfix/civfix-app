import { z } from "zod"
import {
  DonationDisputeStateSchema,
  DonationStatusSchema,
  EligibilityVerdictSchema,
  IdSchema,
  ISODateSchema,
  OrgPaymentsStateSchema,
  pageResponse,
} from "../common.js"
import { MoneyDTOSchema } from "../entities.js"
import { OrgEligibilityDTOSchema, OrgPaymentsStatusDTOSchema } from "../payments.js"
import { AdminActorRefSchema, AdminListQuerySchema } from "./common.js"


export const GetAdminOrgPaymentsRequestSchema = z.object({ id: IdSchema }).strict()
export type GetAdminOrgPaymentsRequest = z.infer<typeof GetAdminOrgPaymentsRequestSchema>

const AdminOrgPaymentsDTOObjectSchema = z.object({
  organizationId: IdSchema,
  orgName: z.string(),
  orgSlug: z.string(),
  status: OrgPaymentsStatusDTOSchema,
  agreementHistory: z
    .array(
      z.object({
        version: z.string(),
        acceptedAt: ISODateSchema,
        acceptedByName: z.string().nullable().optional(),
        surface: z.string().nullable().optional(),
      }),
    )
    .default([]),
  lifetimeGrossMinor: z.number().int().nonnegative().default(0),
  lifetimeDonationCount: z.number().int().nonnegative().default(0),
  disabledBy: AdminActorRefSchema.nullable().optional(),
  disabledReasonText: z.string().nullable().optional(),
})
export type AdminOrgPaymentsDTO = z.infer<typeof AdminOrgPaymentsDTOObjectSchema>
export const AdminOrgPaymentsDTOSchema: z.ZodType<AdminOrgPaymentsDTO, z.ZodTypeDef, unknown> =
  AdminOrgPaymentsDTOObjectSchema

export const GetAdminOrgPaymentsResponseSchema = AdminOrgPaymentsDTOSchema
export type GetAdminOrgPaymentsResponse = z.infer<typeof GetAdminOrgPaymentsResponseSchema>

export const AdminPaymentsEligibilityListQuerySchema = AdminListQuerySchema.extend({
  verdict: EligibilityVerdictSchema.optional(),
  state: OrgPaymentsStateSchema.optional(),
})
export type AdminPaymentsEligibilityListQuery = z.infer<
  typeof AdminPaymentsEligibilityListQuerySchema
>

export const EinSourceSchema = z.enum(["org_verification", "operator"])
export type EinSource = z.infer<typeof EinSourceSchema>

const AdminPaymentsEligibilityRowDTOObjectSchema = z.object({
  organizationId: IdSchema,
  orgName: z.string(),
  orgSlug: z.string(),
  paymentsState: OrgPaymentsStateSchema,
  donationsEnabled: z.boolean().default(false),
  donationsDisabledReason: z.string().nullable().optional(),
  eligibility: OrgEligibilityDTOSchema,
  einSource: EinSourceSchema.nullable().optional(),
  groupExemptionSubordinate: z.boolean().optional(),
  centralOrgConfirmedAt: ISODateSchema.nullable().optional(),
})
export type AdminPaymentsEligibilityRowDTO = z.infer<typeof AdminPaymentsEligibilityRowDTOObjectSchema>
export const AdminPaymentsEligibilityRowDTOSchema: z.ZodType<AdminPaymentsEligibilityRowDTO, z.ZodTypeDef, unknown> =
  AdminPaymentsEligibilityRowDTOObjectSchema

export const AdminPaymentsEligibilityListResponseSchema = pageResponse(
  AdminPaymentsEligibilityRowDTOSchema,
).extend({
  counts: z
    .object({
      eligible: z.number().int().nonnegative(),
      grace: z.number().int().nonnegative(),
      ineligible: z.number().int().nonnegative(),
      reviewRequired: z.number().int().nonnegative(),
      unknown: z.number().int().nonnegative(),
    })
    .optional(),
})
export type AdminPaymentsEligibilityListResponse = z.infer<
  typeof AdminPaymentsEligibilityListResponseSchema
>

export const SetOrgEligibilityEinRequestSchema = z
  .object({
    id: IdSchema,
    ein: z
      .string()
      .trim()
      .regex(/^\d{2}-?\d{7}$/, "must be a nine-digit EIN"),
  })
  .strict()
export type SetOrgEligibilityEinRequest = z.infer<typeof SetOrgEligibilityEinRequestSchema>

export const SetOrgEligibilityEinResponseSchema = z
  .object({
    ok: z.literal(true),
    einLast4: z.string(),
  })
  .strict()
export type SetOrgEligibilityEinResponse = z.infer<typeof SetOrgEligibilityEinResponseSchema>

export const ConfirmOrgCentralOrgRequestSchema = z
  .object({
    id: IdSchema,
    confirmed: z.boolean(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
export type ConfirmOrgCentralOrgRequest = z.infer<typeof ConfirmOrgCentralOrgRequestSchema>

export const ConfirmOrgCentralOrgResponseSchema = z
  .object({
    ok: z.literal(true),
    centralOrgConfirmedAt: ISODateSchema.nullable(),
  })
  .strict()
export type ConfirmOrgCentralOrgResponse = z.infer<typeof ConfirmOrgCentralOrgResponseSchema>

export const EvaluateOrgEligibilityRequestSchema = z.object({ id: IdSchema }).strict()
export type EvaluateOrgEligibilityRequest = z.infer<typeof EvaluateOrgEligibilityRequestSchema>

export const EvaluateOrgEligibilityResponseSchema = z
  .object({
    ok: z.literal(true),
    queued: z.boolean(),
  })
  .strict()
export type EvaluateOrgEligibilityResponse = z.infer<typeof EvaluateOrgEligibilityResponseSchema>

export const SetOrgDonationsEnabledRequestSchema = z
  .object({
    id: IdSchema,
    enabled: z.boolean(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
export type SetOrgDonationsEnabledRequest = z.infer<typeof SetOrgDonationsEnabledRequestSchema>

export const SetOrgDonationsEnabledResponseSchema = z
  .object({
    ok: z.literal(true),
    donationsEnabled: z.boolean(),
  })
  .strict()
export type SetOrgDonationsEnabledResponse = z.infer<typeof SetOrgDonationsEnabledResponseSchema>

export const AdminDonationListQuerySchema = AdminListQuerySchema.extend({
  status: DonationStatusSchema.optional(),
  organizationId: IdSchema.optional(),
  from: ISODateSchema.optional(),
  to: ISODateSchema.optional(),
})
export type AdminDonationListQuery = z.infer<typeof AdminDonationListQuerySchema>

const AdminDonationListItemDTOObjectSchema = z.object({
  id: IdSchema,
  reference: z.string(),
  organizationId: IdSchema,
  orgName: z.string(),
  amount: MoneyDTOSchema,
  platformFeeMinor: z.number().int().nonnegative(),
  status: DonationStatusSchema,
  disputeState: DonationDisputeStateSchema.default("none"),
  refundedTotalMinor: z.number().int().nonnegative().default(0),
  chargedAt: ISODateSchema.nullable(),
  createdAt: ISODateSchema,
  receiptSentAt: ISODateSchema.nullable().optional(),
  livemode: z.boolean().default(false),
})
export type AdminDonationListItemDTO = z.infer<typeof AdminDonationListItemDTOObjectSchema>
export const AdminDonationListItemDTOSchema: z.ZodType<AdminDonationListItemDTO, z.ZodTypeDef, unknown> =
  AdminDonationListItemDTOObjectSchema

const AdminDonationListResponseObjectSchema = pageResponse(AdminDonationListItemDTOSchema).extend({
  totals: z
    .object({
      grossMinor: z.number().int().nonnegative(),
      platformFeeMinor: z.number().int().nonnegative(),
      refundedMinor: z.number().int().nonnegative(),
      count: z.number().int().nonnegative(),
    })
    .optional(),
})
export type AdminDonationListResponse = z.infer<typeof AdminDonationListResponseObjectSchema>
export const AdminDonationListResponseSchema: z.ZodType<AdminDonationListResponse, z.ZodTypeDef, unknown> =
  AdminDonationListResponseObjectSchema

export const AdminDonationTotalsByOrgQuerySchema = z
  .object({
    from: ISODateSchema,
    to: ISODateSchema,
    status: DonationStatusSchema.optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict()
export type AdminDonationTotalsByOrgQuery = z.infer<typeof AdminDonationTotalsByOrgQuerySchema>

const AdminDonationOrgTotalsDTOObjectSchema = z.object({
  organizationId: IdSchema,
  orgName: z.string(),
  orgSlug: z.string(),
  count: z.number().int().nonnegative(),
  grossMinor: z.number().int().nonnegative(),
  platformFeeMinor: z.number().int().nonnegative(),
  refundedMinor: z.number().int().nonnegative(),
  netMinor: z.number().int(),
  firstChargedAt: ISODateSchema.nullable(),
  lastChargedAt: ISODateSchema.nullable(),
})
export type AdminDonationOrgTotalsDTO = z.infer<typeof AdminDonationOrgTotalsDTOObjectSchema>
export const AdminDonationOrgTotalsDTOSchema: z.ZodType<AdminDonationOrgTotalsDTO, z.ZodTypeDef, unknown> =
  AdminDonationOrgTotalsDTOObjectSchema

const AdminDonationTotalsByOrgResponseObjectSchema = z.object({
  from: ISODateSchema,
  to: ISODateSchema,
  items: z.array(AdminDonationOrgTotalsDTOSchema),
  truncated: z.boolean().default(false),
  totals: z.object({
    count: z.number().int().nonnegative(),
    grossMinor: z.number().int().nonnegative(),
    platformFeeMinor: z.number().int().nonnegative(),
    refundedMinor: z.number().int().nonnegative(),
    netMinor: z.number().int(),
  }),
})
export type AdminDonationTotalsByOrgResponse = z.infer<
  typeof AdminDonationTotalsByOrgResponseObjectSchema
>
export const AdminDonationTotalsByOrgResponseSchema: z.ZodType<AdminDonationTotalsByOrgResponse, z.ZodTypeDef, unknown> =
  AdminDonationTotalsByOrgResponseObjectSchema

const AdminPlatformDonationSettingsDTOObjectSchema = z.object({
  paymentsEnabled: z.boolean(),
  registrationNumber: z.string().nullable(),
  platformFeeBps: z.number().int().nonnegative(),
  minAmountMinor: z.number().int().positive(),
  maxAmountMinor: z.number().int().positive(),
  currency: z.string(),
  eligibilityStaleGraceHours: z.number().int().nonnegative(),
  paymentMethodDomains: z.array(z.string()).default([]),
  reviewRequiredBlocks: z.boolean().optional(),
})
export type AdminPlatformDonationSettingsDTO = z.infer<
  typeof AdminPlatformDonationSettingsDTOObjectSchema
>
export const AdminPlatformDonationSettingsDTOSchema: z.ZodType<AdminPlatformDonationSettingsDTO, z.ZodTypeDef, unknown> =
  AdminPlatformDonationSettingsDTOObjectSchema

export const GetAdminPlatformDonationSettingsResponseSchema =
  AdminPlatformDonationSettingsDTOSchema
export type GetAdminPlatformDonationSettingsResponse = z.infer<
  typeof GetAdminPlatformDonationSettingsResponseSchema
>
