import { z } from "zod"
import {
  EMAIL_MAX_LENGTH,
  IdSchema,
  ISODateSchema,
  OrganizationMemberRoleSchema,
  OrgVerificationKindSchema,
  OrgVerificationStatusSchema,
  PaginationQuerySchema,
  pageResponse,
} from "../common.js"
import { OkResponseSchema } from "../internal-fields.js"
import {
  CleanupDTOSchema,
  HttpsUrlSchema,
  OrganizationDTOSchema,
  OrganizationMemberDTOSchema,
  OrganizationRefDTOSchema,
  PersonDTOSchema,
  SocialLinksSchema,
} from "../entities.js"


export {
  HttpsUrlSchema,
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
export const MAX_ORG_VERIFICATION_NOTE = 1000
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

/**
 * The org's public events list (GET /orgs/by-slug/:slug/events). Keyed by `slug` so the public org
 * page needs no id, and it obeys the §32 suspension rule (a suspended org 404s for outsiders). Only
 * `visibility: "public"` events are returned: this is an anonymous read surface.
 */
export const ListOrganizationEventsRequestSchema = PaginationQuerySchema.extend({
  slug: OrgSlugSchema,
  when: z.enum(["upcoming", "past"]).default("upcoming"),
}).strict()
export type ListOrganizationEventsRequest = z.infer<typeof ListOrganizationEventsRequestSchema>

const ListOrganizationEventsResponseObjectSchema = pageResponse(CleanupDTOSchema)
export type ListOrganizationEventsResponse = z.infer<typeof ListOrganizationEventsResponseObjectSchema>
export const ListOrganizationEventsResponseSchema: z.ZodType<ListOrganizationEventsResponse, z.ZodTypeDef, unknown> =
  ListOrganizationEventsResponseObjectSchema

export const UpdateOrganizationRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(MAX_ORG_NAME).optional(),
    description: z.string().max(MAX_ORG_DESCRIPTION).nullable().optional(),
    websiteUrl: HttpsUrlSchema.nullable().optional(),
    donationUrl: HttpsUrlSchema.nullable().optional(),
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

export const OrganizationInviteRoleSchema = z.enum(["admin", "member"])
export type OrganizationInviteRole = z.infer<typeof OrganizationInviteRoleSchema>

export const OrgInviteIdentifierKindSchema = z.enum(["handle", "email"])
export type OrgInviteIdentifierKind = z.infer<typeof OrgInviteIdentifierKindSchema>

export const InviteOrganizationMemberRequestSchema = z
  .object({
    id: IdSchema,
    identifierKind: OrgInviteIdentifierKindSchema,
    identifier: z.string().trim().min(1).max(EMAIL_MAX_LENGTH),
    role: OrganizationInviteRoleSchema,
  })
  .strict()
export type InviteOrganizationMemberRequest = z.infer<typeof InviteOrganizationMemberRequestSchema>

export const OrganizationInviteStatusSchema = z.enum([
  "pending",
  "accepted",
  "revoked",
  "expired",
  "declined",
])
export type OrganizationInviteStatus = z.infer<typeof OrganizationInviteStatusSchema>

/**
 * A pending org membership invite. An email invite has `email` and no `user`; a handle invite to an
 * existing account has `user` and no `email`.
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
  // The pending invite record when the identifier did not resolve to an existing member.
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

export type RevokeOrganizationInviteResponse = z.infer<typeof OkResponseSchema>
export const RevokeOrganizationInviteResponseSchema: z.ZodType<RevokeOrganizationInviteResponse, z.ZodTypeDef, unknown> =
  OkResponseSchema

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
 * `role` is the accepter's seated role, not the invite's: an existing owner who accepts an invite
 * keeps their seat and is reported as `owner`. Invites themselves can only grant admin or member.
 */
const AcceptOrganizationInviteResponseObjectSchema = z.object({
  ok: z.literal(true),
  organization: OrganizationDTOSchema,
  role: OrganizationMemberRoleSchema,
})
export type AcceptOrganizationInviteResponse = z.infer<typeof AcceptOrganizationInviteResponseObjectSchema>
export const AcceptOrganizationInviteResponseSchema: z.ZodType<AcceptOrganizationInviteResponse, z.ZodTypeDef, unknown> =
  AcceptOrganizationInviteResponseObjectSchema

/**
 * The invitee's view of a pending org invite (DECISIONS §34). No `email` field: the reader already
 * knows their own address and the only other address it could carry is somebody else's. `expiresAt`
 * is required so the inbox row can be triaged. `organization` is the badge ref, not the full
 * `OrganizationDTO`, because the invitee is not seated yet and has no claim on member counts.
 */
const PendingOrganizationInviteDTOObjectSchema = z.object({
  id: IdSchema,
  organization: OrganizationRefDTOSchema,
  role: OrganizationInviteRoleSchema,
  invitedBy: PersonDTOSchema.nullable(),
  createdAt: ISODateSchema,
  expiresAt: ISODateSchema,
})
export type PendingOrganizationInviteDTO = z.infer<typeof PendingOrganizationInviteDTOObjectSchema>
export const PendingOrganizationInviteDTOSchema: z.ZodType<PendingOrganizationInviteDTO, z.ZodTypeDef, unknown> =
  PendingOrganizationInviteDTOObjectSchema

const ListMyOrgInvitesResponseObjectSchema = z.object({
  items: z.array(PendingOrganizationInviteDTOSchema),
})
export type ListMyOrgInvitesResponse = z.infer<typeof ListMyOrgInvitesResponseObjectSchema>
export const ListMyOrgInvitesResponseSchema: z.ZodType<ListMyOrgInvitesResponse, z.ZodTypeDef, unknown> =
  ListMyOrgInvitesResponseObjectSchema

/**
 * Accept/decline are token-free: the invite is addressed to the session's account, so a capability
 * token handed to the client only to come straight back would be a secret in flight for no gain
 * (§33). Ownership is `organization_invites.user_id` = the viewer (DECISIONS §33/§34).
 * `acceptOrganizationInvite` ({ token }) stays the path for the emailed link.
 */
export const AcceptMyOrgInviteRequestSchema = z.object({ inviteId: IdSchema }).strict()
export type AcceptMyOrgInviteRequest = z.infer<typeof AcceptMyOrgInviteRequestSchema>

export const AcceptMyOrgInviteResponseSchema = AcceptOrganizationInviteResponseSchema
export type AcceptMyOrgInviteResponse = AcceptOrganizationInviteResponse

export const DeclineMyOrgInviteRequestSchema = z.object({ inviteId: IdSchema }).strict()
export type DeclineMyOrgInviteRequest = z.infer<typeof DeclineMyOrgInviteRequestSchema>

export type DeclineMyOrgInviteResponse = z.infer<typeof OkResponseSchema>
export const DeclineMyOrgInviteResponseSchema: z.ZodType<DeclineMyOrgInviteResponse, z.ZodTypeDef, unknown> =
  OkResponseSchema

export const SetOrganizationMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: OrganizationInviteRoleSchema,
  })
  .strict()
export type SetOrganizationMemberRoleRequest = z.infer<
  typeof SetOrganizationMemberRoleRequestSchema
>

export const SetOrganizationMemberRoleResponseSchema = OkResponseSchema
export type SetOrganizationMemberRoleResponse = z.infer<
  typeof SetOrganizationMemberRoleResponseSchema
>

export const RemoveOrganizationMemberRequestSchema = z
  .object({ id: IdSchema, userId: IdSchema })
  .strict()
export type RemoveOrganizationMemberRequest = z.infer<typeof RemoveOrganizationMemberRequestSchema>

export const RemoveOrganizationMemberResponseSchema = OkResponseSchema
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
    note: z.string().max(MAX_ORG_VERIFICATION_NOTE).nullable().optional(),
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
