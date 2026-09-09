import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  OrganizationMemberRoleSchema,
  OrgVerificationKindSchema,
  OrgVerificationStatusSchema,
  PaginationQuerySchema,
  pageResponse,
} from "../common.js"
import {
  OrganizationDTOSchema,
  OrganizationMemberDTOSchema,
  PersonDTOSchema,
  SocialLinksSchema,
} from "../entities.js"


export {
  OrganizationDTOSchema,
  OrganizationRefDTOSchema,
  OrganizationMemberDTOSchema,
} from "../entities.js"
export type {
  OrganizationDTO,
  OrganizationRefDTO,
  OrganizationMemberDTO,
} from "../entities.js"
export { OrganizationMemberRoleSchema, OrgVerificationKindSchema, OrgVerificationStatusSchema } from "../common.js"
export type { OrganizationMemberRole, OrgVerificationKind, OrgVerificationStatus } from "../common.js"

export const MAX_ORG_NAME = 120
export const MAX_ORG_DESCRIPTION = 2000
export const MAX_ORG_VERIFICATION_DOCUMENTS = 10
export const MAX_ORG_INVITES_PER_ORG = 50
export const ORG_SLUG_MIN = 3
export const ORG_SLUG_MAX = 40

export const OrgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(ORG_SLUG_MIN)
  .max(ORG_SLUG_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export type OrgSlug = z.infer<typeof OrgSlugSchema>

export const HttpsUrlSchema = z.string().trim().url().max(500).startsWith("https://")

export const CreateOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_ORG_NAME),
    slug: OrgSlugSchema,
    description: z.string().max(MAX_ORG_DESCRIPTION).nullable().optional(),
    websiteUrl: HttpsUrlSchema.nullable().optional(),
    logoMediaId: IdSchema.nullable().optional(),
    socialLinks: SocialLinksSchema.nullable().optional(),
  })
  .strict()
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>

export const CreateOrganizationResponseSchema = OrganizationDTOSchema
export type CreateOrganizationResponse = z.infer<typeof CreateOrganizationResponseSchema>

const ListMyOrganizationsResponseObjectSchema = z.object({
  items: z.array(OrganizationDTOSchema),
})
export type ListMyOrganizationsResponse = z.infer<typeof ListMyOrganizationsResponseObjectSchema>
export const ListMyOrganizationsResponseSchema: z.ZodType<ListMyOrganizationsResponse, z.ZodTypeDef, unknown> =
  ListMyOrganizationsResponseObjectSchema

export const GetOrganizationRequestSchema = z.object({ slug: OrgSlugSchema }).strict()
export type GetOrganizationRequest = z.infer<typeof GetOrganizationRequestSchema>

export const GetOrganizationResponseSchema = OrganizationDTOSchema
export type GetOrganizationResponse = z.infer<typeof GetOrganizationResponseSchema>

export const UpdateOrganizationRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(MAX_ORG_NAME).optional(),
    description: z.string().max(MAX_ORG_DESCRIPTION).nullable().optional(),
    websiteUrl: HttpsUrlSchema.nullable().optional(),
    logoMediaId: IdSchema.nullable().optional(),
    socialLinks: SocialLinksSchema.nullable().optional(),
  })
  .strict()
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>

export const UpdateOrganizationResponseSchema = OrganizationDTOSchema
export type UpdateOrganizationResponse = z.infer<typeof UpdateOrganizationResponseSchema>

export const ListOrganizationMembersRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
}).strict()
export type ListOrganizationMembersRequest = z.infer<typeof ListOrganizationMembersRequestSchema>

const ListOrganizationMembersResponseObjectSchema = pageResponse(OrganizationMemberDTOSchema)
export type ListOrganizationMembersResponse = z.infer<typeof ListOrganizationMembersResponseObjectSchema>
export const ListOrganizationMembersResponseSchema: z.ZodType<ListOrganizationMembersResponse, z.ZodTypeDef, unknown> =
  ListOrganizationMembersResponseObjectSchema

export const OrgInviteIdentifierKindSchema = z.enum(["handle", "email"])
export type OrgInviteIdentifierKind = z.infer<typeof OrgInviteIdentifierKindSchema>

export const InviteOrganizationMemberRequestSchema = z
  .object({
    id: IdSchema,
    identifierKind: OrgInviteIdentifierKindSchema,
    identifier: z.string().trim().min(1).max(254),
    role: z.enum(["admin", "member"]),
  })
  .strict()
export type InviteOrganizationMemberRequest = z.infer<typeof InviteOrganizationMemberRequestSchema>

export const OrganizationInviteRoleSchema = z.enum(["admin", "member"])
export type OrganizationInviteRole = z.infer<typeof OrganizationInviteRoleSchema>

export const OrganizationInviteStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"])
export type OrganizationInviteStatus = z.infer<typeof OrganizationInviteStatusSchema>

/**
 * A pending org membership invite (0.41.0). Mirrors `EventTeamInviteDTO`: an email invite has
 * `email` and no `user`; a handle invite to an existing account has `user` and no `email`.
 */
const OrganizationInviteDTOObjectSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  email: z.string().nullable(),
  user: PersonDTOSchema.nullable(),
  role: OrganizationInviteRoleSchema,
  status: OrganizationInviteStatusSchema,
  invitedBy: PersonDTOSchema.nullable(),
  createdAt: ISODateSchema,
  expiresAt: ISODateSchema,
})
export type OrganizationInviteDTO = z.infer<typeof OrganizationInviteDTOObjectSchema>
export const OrganizationInviteDTOSchema: z.ZodType<OrganizationInviteDTO, z.ZodTypeDef, unknown> =
  OrganizationInviteDTOObjectSchema

const InviteOrganizationMemberResponseObjectSchema = z.object({
  ok: z.literal(true),
  member: OrganizationMemberDTOSchema.nullable(),
  invited: z.boolean(),
  // 0.41.0: the pending invite record when the identifier did not resolve to an existing member.
  invite: OrganizationInviteDTOSchema.nullable().optional(),
})
export type InviteOrganizationMemberResponse = z.infer<typeof InviteOrganizationMemberResponseObjectSchema>
export const InviteOrganizationMemberResponseSchema: z.ZodType<InviteOrganizationMemberResponse, z.ZodTypeDef, unknown> =
  InviteOrganizationMemberResponseObjectSchema

export const ListOrganizationInvitesRequestSchema = z.object({ id: IdSchema }).strict()
export type ListOrganizationInvitesRequest = z.infer<typeof ListOrganizationInvitesRequestSchema>

const ListOrganizationInvitesResponseObjectSchema = z.object({
  items: z.array(OrganizationInviteDTOSchema),
})
export type ListOrganizationInvitesResponse = z.infer<typeof ListOrganizationInvitesResponseObjectSchema>
export const ListOrganizationInvitesResponseSchema: z.ZodType<ListOrganizationInvitesResponse, z.ZodTypeDef, unknown> =
  ListOrganizationInvitesResponseObjectSchema

export const RevokeOrganizationInviteRequestSchema = z
  .object({ id: IdSchema, inviteId: IdSchema })
  .strict()
export type RevokeOrganizationInviteRequest = z.infer<typeof RevokeOrganizationInviteRequestSchema>

const RevokeOrganizationInviteResponseObjectSchema = z.object({ ok: z.literal(true) })
export type RevokeOrganizationInviteResponse = z.infer<typeof RevokeOrganizationInviteResponseObjectSchema>
export const RevokeOrganizationInviteResponseSchema: z.ZodType<RevokeOrganizationInviteResponse, z.ZodTypeDef, unknown> =
  RevokeOrganizationInviteResponseObjectSchema

export const ACCEPT_ORG_INVITE_TOKEN_MIN = 20
export const ACCEPT_ORG_INVITE_TOKEN_MAX = 128

/** The token identifies the org, so this request carries no `id` (DECISIONS §32). */
export const AcceptOrganizationInviteRequestSchema = z
  .object({
    token: z.string().min(ACCEPT_ORG_INVITE_TOKEN_MIN).max(ACCEPT_ORG_INVITE_TOKEN_MAX),
  })
  .strict()
export type AcceptOrganizationInviteRequest = z.infer<typeof AcceptOrganizationInviteRequestSchema>

/**
 * `role` is the accepter's SEATED role, not the invite's: an existing owner who accepts an invite
 * keeps their seat and is reported as `owner`. Invites themselves can only grant admin|member.
 */
const AcceptOrganizationInviteResponseObjectSchema = z.object({
  ok: z.literal(true),
  organization: OrganizationDTOSchema,
  role: OrganizationMemberRoleSchema,
})
export type AcceptOrganizationInviteResponse = z.infer<typeof AcceptOrganizationInviteResponseObjectSchema>
export const AcceptOrganizationInviteResponseSchema: z.ZodType<AcceptOrganizationInviteResponse, z.ZodTypeDef, unknown> =
  AcceptOrganizationInviteResponseObjectSchema

export const SetOrganizationMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: z.enum(["admin", "member"]),
  })
  .strict()
export type SetOrganizationMemberRoleRequest = z.infer<
  typeof SetOrganizationMemberRoleRequestSchema
>

export const SetOrganizationMemberRoleResponseSchema = z.object({ ok: z.literal(true) })
export type SetOrganizationMemberRoleResponse = z.infer<
  typeof SetOrganizationMemberRoleResponseSchema
>

export const RemoveOrganizationMemberRequestSchema = z
  .object({ id: IdSchema, userId: IdSchema })
  .strict()
export type RemoveOrganizationMemberRequest = z.infer<typeof RemoveOrganizationMemberRequestSchema>

export const RemoveOrganizationMemberResponseSchema = z.object({ ok: z.literal(true) })
export type RemoveOrganizationMemberResponse = z.infer<
  typeof RemoveOrganizationMemberResponseSchema
>

export const OrgVerificationDocumentSchema = z.object({ mediaId: IdSchema }).strict()
export type OrgVerificationDocument = z.infer<typeof OrgVerificationDocumentSchema>

export const ApplyOrganizationVerificationRequestSchema = z
  .object({
    id: IdSchema,
    kind: OrgVerificationKindSchema,
    einNumber: z
      .string()
      .trim()
      .regex(/^\d{2}-?\d{7}$/)
      .nullable()
      .optional(),
    documents: z.array(OrgVerificationDocumentSchema).max(MAX_ORG_VERIFICATION_DOCUMENTS).default([]),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict()
export type ApplyOrganizationVerificationRequest = z.infer<
  typeof ApplyOrganizationVerificationRequestSchema
>

const OrganizationVerificationDTOObjectSchema = z.object({
  status: OrgVerificationStatusSchema,
  kind: OrgVerificationKindSchema.nullable(),
  submittedAt: ISODateSchema.nullable().optional(),
  reviewedAt: ISODateSchema.nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
})
export type OrganizationVerificationDTO = z.infer<typeof OrganizationVerificationDTOObjectSchema>
export const OrganizationVerificationDTOSchema: z.ZodType<OrganizationVerificationDTO, z.ZodTypeDef, unknown> =
  OrganizationVerificationDTOObjectSchema

export const ApplyOrganizationVerificationResponseSchema = OrganizationVerificationDTOSchema
export type ApplyOrganizationVerificationResponse = z.infer<
  typeof ApplyOrganizationVerificationResponseSchema
>

export const GetOrganizationVerificationRequestSchema = z.object({ id: IdSchema }).strict()
export type GetOrganizationVerificationRequest = z.infer<
  typeof GetOrganizationVerificationRequestSchema
>

export const GetOrganizationVerificationResponseSchema = OrganizationVerificationDTOSchema
export type GetOrganizationVerificationResponse = z.infer<
  typeof GetOrganizationVerificationResponseSchema
>
