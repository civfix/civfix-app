import { z } from "zod"
import {
  CleanupMemberRoleSchema,
  IdSchema,
  ISODateSchema,
  pageResponse,
  PaginationQuerySchema,
} from "../common.js"
import { OkResponseSchema } from "../internal-fields.js"
import { CleanupDTOSchema, InviteEventRefSchema, PersonDTOSchema } from "../entities.js"


export { InviteEventRefSchema } from "../entities.js"
export type { InviteEventRef } from "../entities.js"

export const MAX_TEAM_INVITES_PER_EVENT = 50

export const EventTeamRoleSchema = z.enum(["cohost", "staff", "coordinator"])
export type EventTeamRole = z.infer<typeof EventTeamRoleSchema>

export const EventTeamInviteStatusSchema = z.enum([
  "pending",
  "accepted",
  "revoked",
  "expired",
  "declined",
])
export type EventTeamInviteStatus = z.infer<typeof EventTeamInviteStatusSchema>

const EventTeamMemberDTOObjectSchema = z.object({
  person: PersonDTOSchema,
  role: CleanupMemberRoleSchema,
  joinedAt: ISODateSchema.nullable().optional(),
  canRemove: z.boolean().default(false),
  canChangeRole: z.boolean().default(false),
})
export type EventTeamMemberDTO = z.infer<typeof EventTeamMemberDTOObjectSchema>
export const EventTeamMemberDTOSchema: z.ZodType<EventTeamMemberDTO, z.ZodTypeDef, unknown> =
  EventTeamMemberDTOObjectSchema

const EventTeamInviteDTOObjectSchema = z.object({
  id: IdSchema,
  role: EventTeamRoleSchema,
  status: EventTeamInviteStatusSchema,
  invitee: PersonDTOSchema.nullable().optional(),
  maskedEmail: z.string().nullable().optional(),
  invitedBy: PersonDTOSchema.nullable().optional(),
  createdAt: ISODateSchema,
  expiresAt: ISODateSchema.nullable().optional(),
  acceptedAt: ISODateSchema.nullable().optional(),
})
export type EventTeamInviteDTO = z.infer<typeof EventTeamInviteDTOObjectSchema>
export const EventTeamInviteDTOSchema: z.ZodType<EventTeamInviteDTO, z.ZodTypeDef, unknown> =
  EventTeamInviteDTOObjectSchema

export const ListEventTeamRequestSchema = z.object({ id: IdSchema }).strict()
export type ListEventTeamRequest = z.infer<typeof ListEventTeamRequestSchema>

const ListEventTeamResponseObjectSchema = z.object({
  members: z.array(EventTeamMemberDTOSchema),
  invites: z.array(EventTeamInviteDTOSchema).default([]),
})
export type ListEventTeamResponse = z.infer<typeof ListEventTeamResponseObjectSchema>
export const ListEventTeamResponseSchema: z.ZodType<ListEventTeamResponse, z.ZodTypeDef, unknown> =
  ListEventTeamResponseObjectSchema

export const EventTeamInviteIdentifierKindSchema = z.enum(["handle", "email"])
export type EventTeamInviteIdentifierKind = z.infer<typeof EventTeamInviteIdentifierKindSchema>

export const InviteEventTeamMemberRequestSchema = z
  .object({
    id: IdSchema,
    identifierKind: EventTeamInviteIdentifierKindSchema,
    identifier: z.string().trim().min(1).max(254),
    role: EventTeamRoleSchema,
  })
  .strict()
export type InviteEventTeamMemberRequest = z.infer<typeof InviteEventTeamMemberRequestSchema>

const InviteEventTeamMemberResponseObjectSchema = z.object({
  ok: z.literal(true),
  invite: EventTeamInviteDTOSchema,
})
export type InviteEventTeamMemberResponse = z.infer<typeof InviteEventTeamMemberResponseObjectSchema>
export const InviteEventTeamMemberResponseSchema: z.ZodType<InviteEventTeamMemberResponse, z.ZodTypeDef, unknown> =
  InviteEventTeamMemberResponseObjectSchema

export const RevokeEventTeamInviteRequestSchema = z
  .object({ id: IdSchema, inviteId: IdSchema })
  .strict()
export type RevokeEventTeamInviteRequest = z.infer<typeof RevokeEventTeamInviteRequestSchema>

export type RevokeEventTeamInviteResponse = z.infer<typeof OkResponseSchema>
export const RevokeEventTeamInviteResponseSchema: z.ZodType<RevokeEventTeamInviteResponse, z.ZodTypeDef, unknown> =
  OkResponseSchema

export const ACCEPT_TEAM_INVITE_TOKEN_MIN = 20
export const ACCEPT_TEAM_INVITE_TOKEN_MAX = 128

export const AcceptEventTeamInviteRequestSchema = z
  .object({
    id: IdSchema,
    token: z.string().min(ACCEPT_TEAM_INVITE_TOKEN_MIN).max(ACCEPT_TEAM_INVITE_TOKEN_MAX),
  })
  .strict()
export type AcceptEventTeamInviteRequest = z.infer<typeof AcceptEventTeamInviteRequestSchema>

const AcceptEventTeamInviteResponseObjectSchema = z.object({
  ok: z.literal(true),
  role: CleanupMemberRoleSchema,
})
export type AcceptEventTeamInviteResponse = z.infer<typeof AcceptEventTeamInviteResponseObjectSchema>
export const AcceptEventTeamInviteResponseSchema: z.ZodType<AcceptEventTeamInviteResponse, z.ZodTypeDef, unknown> =
  AcceptEventTeamInviteResponseObjectSchema

const PendingEventTeamInviteDTOObjectSchema = z.object({
  id: IdSchema,
  role: EventTeamRoleSchema,
  event: InviteEventRefSchema,
  invitedBy: PersonDTOSchema.nullable(),
  createdAt: ISODateSchema,
  expiresAt: ISODateSchema,
})
export type PendingEventTeamInviteDTO = z.infer<typeof PendingEventTeamInviteDTOObjectSchema>
export const PendingEventTeamInviteDTOSchema: z.ZodType<PendingEventTeamInviteDTO, z.ZodTypeDef, unknown> =
  PendingEventTeamInviteDTOObjectSchema

export const ListMyEventInvitesRequestSchema = PaginationQuerySchema.strict()
export type ListMyEventInvitesRequest = z.infer<typeof ListMyEventInvitesRequestSchema>

const ListMyEventInvitesResponseObjectSchema = pageResponse(PendingEventTeamInviteDTOSchema)
export type ListMyEventInvitesResponse = z.infer<typeof ListMyEventInvitesResponseObjectSchema>
export const ListMyEventInvitesResponseSchema: z.ZodType<ListMyEventInvitesResponse, z.ZodTypeDef, unknown> =
  ListMyEventInvitesResponseObjectSchema

export const AcceptMyEventInviteRequestSchema = z.object({ inviteId: IdSchema }).strict()
export type AcceptMyEventInviteRequest = z.infer<typeof AcceptMyEventInviteRequestSchema>

const AcceptMyEventInviteResponseObjectSchema = z.object({
  ok: z.literal(true),
  role: CleanupMemberRoleSchema,
  event: CleanupDTOSchema,
})
export type AcceptMyEventInviteResponse = z.infer<typeof AcceptMyEventInviteResponseObjectSchema>
export const AcceptMyEventInviteResponseSchema: z.ZodType<AcceptMyEventInviteResponse, z.ZodTypeDef, unknown> =
  AcceptMyEventInviteResponseObjectSchema

export const DeclineMyEventInviteRequestSchema = z.object({ inviteId: IdSchema }).strict()
export type DeclineMyEventInviteRequest = z.infer<typeof DeclineMyEventInviteRequestSchema>

export type DeclineMyEventInviteResponse = z.infer<typeof OkResponseSchema>
export const DeclineMyEventInviteResponseSchema: z.ZodType<DeclineMyEventInviteResponse, z.ZodTypeDef, unknown> =
  OkResponseSchema
