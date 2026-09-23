import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  OrganizationMemberRoleSchema,
  OrgVerificationKindSchema,
  OrgVerificationStatusSchema,
  PaginationQuerySchema,
  QueryBooleanSchema,
  pageResponse,
} from "../common.js"
import { SocialLinksSchema } from "../entities.js"
import {
  HttpsUrlSchema,
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  OrgSlugSchema,
} from "../host/organizations.js"
import { AdminActorRefSchema, AdminListQuerySchema, AdminOkResponseSchema } from "./common.js"
import { AdminEventListItemDTOSchema } from "./events.js"


export const AdminOrgVerificationListQuerySchema = AdminListQuerySchema.extend({
  status: OrgVerificationStatusSchema.optional(),
  kind: OrgVerificationKindSchema.optional(),
})
export type AdminOrgVerificationListQuery = z.infer<typeof AdminOrgVerificationListQuerySchema>

export const AdminOrgVerificationListItemDTOSchema = z.object({
  organizationId: IdSchema,
  slug: z.string(),
  name: z.string(),
  status: OrgVerificationStatusSchema,
  kind: OrgVerificationKindSchema.nullable(),
  einLast4: z.string().nullable().optional(),
  documentMediaIds: z.array(IdSchema).default([]),
  note: z.string().nullable().optional(),
  submittedBy: AdminActorRefSchema.nullable().optional(),
  submittedAt: ISODateSchema.nullable().optional(),
  reviewedBy: AdminActorRefSchema.nullable().optional(),
  reviewedAt: ISODateSchema.nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
})
export type AdminOrgVerificationListItemDTO = z.infer<
  typeof AdminOrgVerificationListItemDTOSchema
>

export const AdminOrgVerificationListResponseSchema = pageResponse(
  AdminOrgVerificationListItemDTOSchema,
).extend({
  pendingCount: z.number().int().nonnegative().optional(),
})
export type AdminOrgVerificationListResponse = z.infer<
  typeof AdminOrgVerificationListResponseSchema
>

const AdminOrgDTOObjectSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  verifiedStatus: OrgVerificationStatusSchema,
  verifiedKind: OrgVerificationKindSchema.nullable().optional(),
  verifiedAt: ISODateSchema.nullable().optional(),
  createdAt: ISODateSchema,
  deletedAt: ISODateSchema.nullable().optional(),
  memberCount: z.number().int().nonnegative().default(0),
  eventCount: z.number().int().nonnegative().default(0),
  owner: AdminActorRefSchema.nullable().optional(),
  verification: AdminOrgVerificationListItemDTOSchema.nullable().optional(),
  donationUrl: z.string().nullable().optional(),
  // Optional so an older server payload still parses.
  suspendedAt: ISODateSchema.nullable().optional(),
  suspendedReason: z.string().nullable().optional(),
  updatedAt: ISODateSchema.nullable().optional(),
  socialLinks: SocialLinksSchema.nullable().optional(),
  logoMediaId: IdSchema.nullable().optional(),
})
export type AdminOrgDTO = z.infer<typeof AdminOrgDTOObjectSchema>
export const AdminOrgDTOSchema: z.ZodType<AdminOrgDTO, z.ZodTypeDef, unknown> =
  AdminOrgDTOObjectSchema

export const GetAdminOrgRequestSchema = z.object({ id: IdSchema }).strict()
export type GetAdminOrgRequest = z.infer<typeof GetAdminOrgRequestSchema>

export const GetAdminOrgResponseSchema = AdminOrgDTOSchema
export type GetAdminOrgResponse = z.infer<typeof GetAdminOrgResponseSchema>

export const DecideOrgVerificationRequestSchema = z
  .object({
    id: IdSchema,
    decision: z.enum(["verified", "rejected"]),
    kind: OrgVerificationKindSchema.optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
export type DecideOrgVerificationRequest = z.infer<typeof DecideOrgVerificationRequestSchema>

export const DecideOrgVerificationResponseSchema = AdminOrgDTOSchema
export type DecideOrgVerificationResponse = z.infer<typeof DecideOrgVerificationResponseSchema>

const AdminReasonSchema = z.string().trim().min(1).max(1000)

/** Org list query: search matches name/slug/id; every facet is optional and query-string safe. */
export const AdminOrgListQuerySchema = AdminListQuerySchema.extend({
  verified: OrgVerificationStatusSchema.optional(),
  kind: OrgVerificationKindSchema.optional(),
  suspended: QueryBooleanSchema.optional(),
})
export type AdminOrgListQuery = z.infer<typeof AdminOrgListQuerySchema>

/**
 * Per-facet org totals for the filter chips, computed server-side over the SEARCHED set. `pending`
 * counts orgs with a verification awaiting review; `suspended` counts the explicit suspension.
 */
export const AdminOrgCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
  })
  .strict()
export type AdminOrgCounts = z.infer<typeof AdminOrgCountsSchema>

const AdminOrgListResponseObjectSchema = pageResponse(AdminOrgDTOSchema).extend({
  // Optional: computed only on the FIRST page (cursor === null) and omitted on later keyset pages.
  counts: AdminOrgCountsSchema.optional(),
})
export type AdminOrgListResponse = z.infer<typeof AdminOrgListResponseObjectSchema>
export const AdminOrgListResponseSchema: z.ZodType<AdminOrgListResponse, z.ZodTypeDef, unknown> =
  AdminOrgListResponseObjectSchema

export const AdminCreateOrgRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_ORG_NAME),
    slug: OrgSlugSchema,
    description: z.string().max(MAX_ORG_DESCRIPTION).optional(),
    websiteUrl: HttpsUrlSchema.optional(),
    logoMediaId: IdSchema.optional(),
    socialLinks: SocialLinksSchema.optional(),
    ownerUserId: IdSchema,
    // When present the org is created already verified as this kind (no application round-trip).
    verifiedKind: OrgVerificationKindSchema.optional(),
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminCreateOrgRequest = z.infer<typeof AdminCreateOrgRequestSchema>

export const AdminCreateOrgResponseSchema = AdminOrgDTOSchema
export type AdminCreateOrgResponse = z.infer<typeof AdminCreateOrgResponseSchema>

export const AdminUpdateOrgRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(MAX_ORG_NAME).optional(),
    slug: OrgSlugSchema.optional(),
    description: z.string().max(MAX_ORG_DESCRIPTION).nullable().optional(),
    websiteUrl: HttpsUrlSchema.nullable().optional(),
    logoMediaId: IdSchema.nullable().optional(),
    socialLinks: SocialLinksSchema.nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminUpdateOrgRequest = z.infer<typeof AdminUpdateOrgRequestSchema>

export const AdminUpdateOrgResponseSchema = AdminOrgDTOSchema
export type AdminUpdateOrgResponse = z.infer<typeof AdminUpdateOrgResponseSchema>

export const AdminSetOrgSuspendedRequestSchema = z
  .object({
    id: IdSchema,
    suspended: z.boolean(),
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminSetOrgSuspendedRequest = z.infer<typeof AdminSetOrgSuspendedRequestSchema>

export const AdminSetOrgSuspendedResponseSchema = AdminOrgDTOSchema
export type AdminSetOrgSuspendedResponse = z.infer<typeof AdminSetOrgSuspendedResponseSchema>

export const AdminOrgMemberListRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
}).strict()
export type AdminOrgMemberListRequest = z.infer<typeof AdminOrgMemberListRequestSchema>

const AdminOrgMemberDTOObjectSchema = z.object({
  user: AdminActorRefSchema,
  role: OrganizationMemberRoleSchema,
  joinedAt: ISODateSchema,
})
export type AdminOrgMemberDTO = z.infer<typeof AdminOrgMemberDTOObjectSchema>
export const AdminOrgMemberDTOSchema: z.ZodType<AdminOrgMemberDTO, z.ZodTypeDef, unknown> =
  AdminOrgMemberDTOObjectSchema

const AdminOrgMemberListResponseObjectSchema = pageResponse(AdminOrgMemberDTOSchema)
export type AdminOrgMemberListResponse = z.infer<typeof AdminOrgMemberListResponseObjectSchema>
export const AdminOrgMemberListResponseSchema: z.ZodType<
  AdminOrgMemberListResponse,
  z.ZodTypeDef,
  unknown
> = AdminOrgMemberListResponseObjectSchema

/** `role: "owner"` is an ownership transfer: the previous owner is demoted to admin (DECISIONS §32). */
export const AdminAddOrgMemberRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: OrganizationMemberRoleSchema,
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminAddOrgMemberRequest = z.infer<typeof AdminAddOrgMemberRequestSchema>

export const AdminAddOrgMemberResponseSchema = AdminOkResponseSchema
export type AdminAddOrgMemberResponse = z.infer<typeof AdminAddOrgMemberResponseSchema>

export const AdminSetOrgMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: OrganizationMemberRoleSchema,
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminSetOrgMemberRoleRequest = z.infer<typeof AdminSetOrgMemberRoleRequestSchema>

export const AdminSetOrgMemberRoleResponseSchema = AdminOkResponseSchema
export type AdminSetOrgMemberRoleResponse = z.infer<typeof AdminSetOrgMemberRoleResponseSchema>

export const AdminRemoveOrgMemberRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminRemoveOrgMemberRequest = z.infer<typeof AdminRemoveOrgMemberRequestSchema>

export const AdminRemoveOrgMemberResponseSchema = AdminOkResponseSchema
export type AdminRemoveOrgMemberResponse = z.infer<typeof AdminRemoveOrgMemberResponseSchema>

export const AdminOrgEventWhenSchema = z.enum(["upcoming", "past", "all"])
export type AdminOrgEventWhen = z.infer<typeof AdminOrgEventWhenSchema>

export const AdminOrgEventListRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  when: AdminOrgEventWhenSchema.optional(),
}).strict()
export type AdminOrgEventListRequest = z.infer<typeof AdminOrgEventListRequestSchema>

/** An org's event row is the admin events-list row, so the console reuses one row component. */
export const AdminOrgEventDTOSchema = AdminEventListItemDTOSchema
export type AdminOrgEventDTO = z.infer<typeof AdminOrgEventDTOSchema>

const AdminOrgEventListResponseObjectSchema = pageResponse(AdminOrgEventDTOSchema)
export type AdminOrgEventListResponse = z.infer<typeof AdminOrgEventListResponseObjectSchema>
export const AdminOrgEventListResponseSchema: z.ZodType<
  AdminOrgEventListResponse,
  z.ZodTypeDef,
  unknown
> = AdminOrgEventListResponseObjectSchema
