import { z } from "zod"
import {
  BroadcastKindSchema,
  BroadcastStatusSchema,
  IdSchema,
  ISODateSchema,
  QueryBooleanSchema,
  pageResponse,
} from "../common.js"
import { AdminActorRefSchema, AdminListQuerySchema } from "./common.js"


export const SetHostMessagingSuspendedRequestSchema = z
  .object({
    id: IdSchema,
    suspended: z.boolean(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
export type SetHostMessagingSuspendedRequest = z.infer<
  typeof SetHostMessagingSuspendedRequestSchema
>

export const SetHostMessagingSuspendedResponseSchema = z
  .object({
    ok: z.literal(true),
    suspended: z.boolean(),
  })
  .strict()
export type SetHostMessagingSuspendedResponse = z.infer<
  typeof SetHostMessagingSuspendedResponseSchema
>

export const AdminBroadcastListQuerySchema = AdminListQuerySchema.extend({
  status: BroadcastStatusSchema.optional(),
  kind: BroadcastKindSchema.optional(),
  cleanupId: IdSchema.optional(),
  createdBy: IdSchema.optional(),
  from: ISODateSchema.optional(),
  to: ISODateSchema.optional(),
})
export type AdminBroadcastListQuery = z.infer<typeof AdminBroadcastListQuerySchema>

const AdminBroadcastListItemDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  eventTitle: z.string().nullable().optional(),
  kind: BroadcastKindSchema,
  status: BroadcastStatusSchema,
  subjectHash: z.string().nullable().optional(),
  createdBy: AdminActorRefSchema.nullable().optional(),
  recipientCount: z.number().int().nonnegative().default(0),
  sentCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  suppressedCount: z.number().int().nonnegative().default(0),
  channels: z.array(z.string()).default([]),
  createdAt: ISODateSchema,
  finishedAt: ISODateSchema.nullable().optional(),
})
export type AdminBroadcastListItemDTO = z.infer<typeof AdminBroadcastListItemDTOObjectSchema>
export const AdminBroadcastListItemDTOSchema: z.ZodType<AdminBroadcastListItemDTO, z.ZodTypeDef, unknown> =
  AdminBroadcastListItemDTOObjectSchema

const AdminBroadcastListResponseObjectSchema = pageResponse(AdminBroadcastListItemDTOSchema)
export type AdminBroadcastListResponse = z.infer<typeof AdminBroadcastListResponseObjectSchema>
export const AdminBroadcastListResponseSchema: z.ZodType<AdminBroadcastListResponse, z.ZodTypeDef, unknown> =
  AdminBroadcastListResponseObjectSchema

export const AdminHostListQuerySchema = AdminListQuerySchema.extend({
  suspended: QueryBooleanSchema.optional(),
  windowDays: z.coerce.number().int().positive().max(365).optional(),
})
export type AdminHostListQuery = z.infer<typeof AdminHostListQuerySchema>

const AdminHostListItemDTOObjectSchema = z.object({
  host: AdminActorRefSchema,
  messagingSuspended: z.boolean().default(false),
  suspendedAt: ISODateSchema.nullable().optional(),
  suspendedBy: AdminActorRefSchema.nullable().optional(),
  windowDays: z.number().int().positive(),
  broadcastCount: z.number().int().nonnegative().default(0),
  recipientCount: z.number().int().nonnegative().default(0),
  sentCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  suppressedCount: z.number().int().nonnegative().default(0),
  lastBroadcastAt: ISODateSchema.nullable().optional(),
  eventsMessaged: z.number().int().nonnegative().default(0),
})
export type AdminHostListItemDTO = z.infer<typeof AdminHostListItemDTOObjectSchema>
export const AdminHostListItemDTOSchema: z.ZodType<AdminHostListItemDTO, z.ZodTypeDef, unknown> =
  AdminHostListItemDTOObjectSchema

const AdminHostListResponseObjectSchema = pageResponse(AdminHostListItemDTOSchema)
export type AdminHostListResponse = z.infer<typeof AdminHostListResponseObjectSchema>
export const AdminHostListResponseSchema: z.ZodType<AdminHostListResponse, z.ZodTypeDef, unknown> =
  AdminHostListResponseObjectSchema
