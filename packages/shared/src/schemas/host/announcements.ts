import { z } from "zod"
import {
  BroadcastStatusSchema,
  IdSchema,
  ISODateSchema,
  PaginationQuerySchema,
  pageResponse,
} from "../common.js"
import type { BroadcastSegment } from "../common.js"
import { OrganizationRefDTOSchema, PersonDTOSchema } from "../entities.js"
import { MAX_BROADCAST_BODY, MAX_BROADCAST_SUBJECT } from "./broadcasts.js"
import type { HostBroadcastChannel } from "./broadcasts.js"


export const ANNOUNCEMENT_BROADCAST_KIND = "announcement"

export const MAX_ANNOUNCEMENT_TITLE = MAX_BROADCAST_SUBJECT
export const MAX_ANNOUNCEMENT_BODY = MAX_BROADCAST_BODY
export const MAX_ANNOUNCEMENT_SLOT_IDS = 20
export const MAX_EVENT_ANNOUNCEMENTS_PER_DAY = 10

export const ANNOUNCEMENT_CHANNELS: readonly HostBroadcastChannel[] = ["inapp", "push", "email"]

const AnnouncementAudienceUnionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_registered") }).strict(),
  z.object({ kind: z.literal("checked_in") }).strict(),
  z.object({ kind: z.literal("not_checked_in") }).strict(),
  z.object({ kind: z.literal("waitlist") }).strict(),
  z
    .object({
      kind: z.literal("slots"),
      ids: z.array(IdSchema).min(1).max(MAX_ANNOUNCEMENT_SLOT_IDS),
    })
    .strict(),
])
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceUnionSchema>

export const AnnouncementAudienceSchema: z.ZodType<AnnouncementAudience, z.ZodTypeDef, unknown> =
  AnnouncementAudienceUnionSchema

export const ANNOUNCEMENT_AUDIENCE_KINDS = [
  "all_registered",
  "checked_in",
  "not_checked_in",
  "waitlist",
  "slots",
] as const
export type AnnouncementAudienceKind = (typeof ANNOUNCEMENT_AUDIENCE_KINDS)[number]

export function announcementAudienceToSegment(audience: AnnouncementAudience): BroadcastSegment {
  return audience
}

const AnnouncementDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  status: BroadcastStatusSchema,
  author: PersonDTOSchema.nullable().optional(),
  authorOrg: OrganizationRefDTOSchema.nullable().optional(),
  title: z.string().nullable().optional(),
  bodyMd: z.string(),
  audience: AnnouncementAudienceSchema.nullable().optional(),
  recipientCount: z.number().int().nonnegative().optional(),
  sentCount: z.number().int().nonnegative().optional(),
  failedCount: z.number().int().nonnegative().optional(),
  sentAt: ISODateSchema.nullable().optional(),
  createdAt: ISODateSchema,
})
export type AnnouncementDTO = z.infer<typeof AnnouncementDTOObjectSchema>
export const AnnouncementDTOSchema: z.ZodType<AnnouncementDTO, z.ZodTypeDef, unknown> =
  AnnouncementDTOObjectSchema

export const CreateEventAnnouncementRequestSchema = z
  .object({
    id: IdSchema,
    title: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_TITLE).nullable().optional(),
    bodyMd: z.string().trim().min(1).max(MAX_ANNOUNCEMENT_BODY),
    audience: AnnouncementAudienceSchema,
  })
  .strict()
export type CreateEventAnnouncementRequest = z.infer<typeof CreateEventAnnouncementRequestSchema>

export const CreateEventAnnouncementResponseSchema = AnnouncementDTOSchema
export type CreateEventAnnouncementResponse = z.infer<typeof CreateEventAnnouncementResponseSchema>

export const ListEventAnnouncementsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
}).strict()
export type ListEventAnnouncementsRequest = z.infer<typeof ListEventAnnouncementsRequestSchema>

const ListEventAnnouncementsResponseObjectSchema = pageResponse(AnnouncementDTOSchema)
export type ListEventAnnouncementsResponse = z.infer<
  typeof ListEventAnnouncementsResponseObjectSchema
>
export const ListEventAnnouncementsResponseSchema: z.ZodType<
  ListEventAnnouncementsResponse,
  z.ZodTypeDef,
  unknown
> = ListEventAnnouncementsResponseObjectSchema

export const GetEventAnnouncementRequestSchema = z
  .object({ id: IdSchema, announcementId: IdSchema })
  .strict()
export type GetEventAnnouncementRequest = z.infer<typeof GetEventAnnouncementRequestSchema>

export const GetEventAnnouncementResponseSchema = AnnouncementDTOSchema
export type GetEventAnnouncementResponse = z.infer<typeof GetEventAnnouncementResponseSchema>
