import { z } from "zod"
import {
  EventPageStatusSchema,
  EventVisibilitySchema,
  IdSchema,
  ISODateSchema,
  QueryBooleanSchema,
  pageResponse,
} from "../common.js"
import { EventPageDTOSchema } from "../entities.js"
import { AdminActorRefSchema, AdminListQuerySchema } from "./common.js"


export const AdminEventPageListQuerySchema = AdminListQuerySchema.extend({
  status: EventPageStatusSchema.optional(),
  flagged: QueryBooleanSchema.optional(),
})
export type AdminEventPageListQuery = z.infer<typeof AdminEventPageListQuerySchema>

const AdminEventPageListItemDTOObjectSchema = z.object({
  cleanupId: IdSchema,
  slug: z.string().nullable(),
  title: z.string(),
  status: EventPageStatusSchema,
  visibility: EventVisibilitySchema,
  organizer: AdminActorRefSchema.nullable().optional(),
  orgName: z.string().nullable().optional(),
  viewCount: z.number().int().nonnegative().default(0),
  publishedAt: ISODateSchema.nullable().optional(),
  flaggedAt: ISODateSchema.nullable().optional(),
  flagReason: z.string().nullable().optional(),
  flaggedBy: AdminActorRefSchema.nullable().optional(),
})
export type AdminEventPageListItemDTO = z.infer<typeof AdminEventPageListItemDTOObjectSchema>
export const AdminEventPageListItemDTOSchema: z.ZodType<AdminEventPageListItemDTO, z.ZodTypeDef, unknown> =
  AdminEventPageListItemDTOObjectSchema

const AdminEventPageListResponseObjectSchema = pageResponse(AdminEventPageListItemDTOSchema)
export type AdminEventPageListResponse = z.infer<typeof AdminEventPageListResponseObjectSchema>
export const AdminEventPageListResponseSchema: z.ZodType<AdminEventPageListResponse, z.ZodTypeDef, unknown> =
  AdminEventPageListResponseObjectSchema

export const FlagEventPageRequestSchema = z
  .object({
    id: IdSchema,
    flagged: z.boolean(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
export type FlagEventPageRequest = z.infer<typeof FlagEventPageRequestSchema>

export const FlagEventPageResponseSchema = AdminEventPageListItemDTOSchema
export type FlagEventPageResponse = z.infer<typeof FlagEventPageResponseSchema>

export const UnpublishEventPageRequestSchema = z
  .object({
    id: IdSchema,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
export type UnpublishEventPageRequest = z.infer<typeof UnpublishEventPageRequestSchema>

export const UnpublishEventPageResponseSchema = AdminEventPageListItemDTOSchema
export type UnpublishEventPageResponse = z.infer<typeof UnpublishEventPageResponseSchema>

export const AdminGetEventPageRequestSchema = z.object({ id: IdSchema }).strict()
export type AdminGetEventPageRequest = z.infer<typeof AdminGetEventPageRequestSchema>

export const AdminGetEventPageResponseSchema = EventPageDTOSchema
export type AdminGetEventPageResponse = z.infer<typeof AdminGetEventPageResponseSchema>
