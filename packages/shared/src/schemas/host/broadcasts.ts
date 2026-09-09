import { z } from "zod"
import {
  BroadcastChannelSchema,
  BroadcastSegmentSchema,
  BroadcastStatusSchema,
  DeliveryStatusSchema,
  IdSchema,
  ISODateSchema,
  PaginationQuerySchema,
  pageResponse,
} from "../common.js"
import { BroadcastDTOSchema } from "../entities.js"
import { MARKDOWN_SUBSET_MAX_CHARS } from "../../markdown/parse.js"


export { BroadcastDTOSchema } from "../entities.js"
export type { BroadcastDTO } from "../entities.js"
export {
  BroadcastChannelSchema,
  BroadcastKindSchema,
  BroadcastSegmentSchema,
  BroadcastStatusSchema,
  DeliveryStatusSchema,
} from "../common.js"
export type {
  BroadcastChannel,
  BroadcastKind,
  BroadcastSegment,
  BroadcastStatus,
  DeliveryStatus,
} from "../common.js"

export const MAX_BROADCAST_SUBJECT = 160
export const MAX_BROADCAST_BODY = MARKDOWN_SUBSET_MAX_CHARS
export const MAX_BROADCAST_CTA_LABEL = 60

export const HostBroadcastChannelSchema = z.enum(["inapp", "push", "email"])
export type HostBroadcastChannel = z.infer<typeof HostBroadcastChannelSchema>

export const PUSH_REQUIRES_INAPP_MESSAGE =
  "push notifications ride the in-app notification, so \"inapp\" must be selected with \"push\""

export function hostBroadcastChannelsValid(channels: readonly HostBroadcastChannel[]): boolean {
  return !channels.includes("push") || channels.includes("inapp")
}

export const HostBroadcastChannelsSchema = z
  .array(HostBroadcastChannelSchema)
  .min(1)
  .max(3)
  .refine(hostBroadcastChannelsValid, { message: PUSH_REQUIRES_INAPP_MESSAGE })

export const HttpsCtaUrlSchema = z.string().trim().url().max(500).startsWith("https://")

const BroadcastDraftFields = {
  subject: z.string().trim().min(1).max(MAX_BROADCAST_SUBJECT),
  bodyMd: z.string().trim().min(1).max(MAX_BROADCAST_BODY),
  ctaLabel: z.string().trim().max(MAX_BROADCAST_CTA_LABEL).nullable().optional(),
  ctaUrl: HttpsCtaUrlSchema.nullable().optional(),
  segment: BroadcastSegmentSchema,
  channels: HostBroadcastChannelsSchema,
} as const

export const ListEventBroadcastsRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  status: BroadcastStatusSchema.optional(),
}).strict()
export type ListEventBroadcastsRequest = z.infer<typeof ListEventBroadcastsRequestSchema>

const ListEventBroadcastsResponseObjectSchema = pageResponse(BroadcastDTOSchema)
export type ListEventBroadcastsResponse = z.infer<typeof ListEventBroadcastsResponseObjectSchema>
export const ListEventBroadcastsResponseSchema: z.ZodType<ListEventBroadcastsResponse, z.ZodTypeDef, unknown> =
  ListEventBroadcastsResponseObjectSchema

export const GetEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema })
  .strict()
export type GetEventBroadcastRequest = z.infer<typeof GetEventBroadcastRequestSchema>

export const GetEventBroadcastResponseSchema = BroadcastDTOSchema
export type GetEventBroadcastResponse = z.infer<typeof GetEventBroadcastResponseSchema>

export const CreateEventBroadcastRequestSchema = z
  .object({ id: IdSchema, ...BroadcastDraftFields })
  .strict()
export type CreateEventBroadcastRequest = z.infer<typeof CreateEventBroadcastRequestSchema>

export const CreateEventBroadcastResponseSchema = BroadcastDTOSchema
export type CreateEventBroadcastResponse = z.infer<typeof CreateEventBroadcastResponseSchema>

export const UpdateEventBroadcastRequestSchema = z
  .object({
    id: IdSchema,
    broadcastId: IdSchema,
    subject: z.string().trim().min(1).max(MAX_BROADCAST_SUBJECT).optional(),
    bodyMd: z.string().trim().min(1).max(MAX_BROADCAST_BODY).optional(),
    ctaLabel: z.string().trim().max(MAX_BROADCAST_CTA_LABEL).nullable().optional(),
    ctaUrl: HttpsCtaUrlSchema.nullable().optional(),
    segment: BroadcastSegmentSchema.optional(),
    channels: HostBroadcastChannelsSchema.optional(),
  })
  .strict()
export type UpdateEventBroadcastRequest = z.infer<typeof UpdateEventBroadcastRequestSchema>

export const UpdateEventBroadcastResponseSchema = BroadcastDTOSchema
export type UpdateEventBroadcastResponse = z.infer<typeof UpdateEventBroadcastResponseSchema>

export const DeleteEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema })
  .strict()
export type DeleteEventBroadcastRequest = z.infer<typeof DeleteEventBroadcastRequestSchema>

const DeleteEventBroadcastResponseObjectSchema = z.object({ ok: z.literal(true) })
export type DeleteEventBroadcastResponse = z.infer<typeof DeleteEventBroadcastResponseObjectSchema>
export const DeleteEventBroadcastResponseSchema: z.ZodType<DeleteEventBroadcastResponse, z.ZodTypeDef, unknown> =
  DeleteEventBroadcastResponseObjectSchema

export const PreviewEventBroadcastRequestSchema = z
  .object({
    id: IdSchema,
    broadcastId: IdSchema.optional(),
    subject: z.string().trim().min(1).max(MAX_BROADCAST_SUBJECT).optional(),
    bodyMd: z.string().trim().min(1).max(MAX_BROADCAST_BODY).optional(),
    ctaLabel: z.string().trim().max(MAX_BROADCAST_CTA_LABEL).nullable().optional(),
    ctaUrl: HttpsCtaUrlSchema.nullable().optional(),
    segment: BroadcastSegmentSchema.optional(),
    channels: HostBroadcastChannelsSchema.optional(),
  })
  .strict()
export type PreviewEventBroadcastRequest = z.infer<typeof PreviewEventBroadcastRequestSchema>

const BroadcastPreviewDTOObjectSchema = z.object({
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  pushTitle: z.string(),
  pushBody: z.string(),
  inAppTitle: z.string(),
  inAppBody: z.string(),
  recipientCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([]),
})
export type BroadcastPreviewDTO = z.infer<typeof BroadcastPreviewDTOObjectSchema>
export const BroadcastPreviewDTOSchema: z.ZodType<BroadcastPreviewDTO, z.ZodTypeDef, unknown> =
  BroadcastPreviewDTOObjectSchema

export const PreviewEventBroadcastResponseSchema = BroadcastPreviewDTOSchema
export type PreviewEventBroadcastResponse = z.infer<typeof PreviewEventBroadcastResponseSchema>

export const TestSendEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema })
  .strict()
export type TestSendEventBroadcastRequest = z.infer<typeof TestSendEventBroadcastRequestSchema>

const TestSendEventBroadcastResponseObjectSchema = z.object({ ok: z.literal(true) })
export type TestSendEventBroadcastResponse = z.infer<typeof TestSendEventBroadcastResponseObjectSchema>
export const TestSendEventBroadcastResponseSchema: z.ZodType<TestSendEventBroadcastResponse, z.ZodTypeDef, unknown> =
  TestSendEventBroadcastResponseObjectSchema

export const SendEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema })
  .strict()
export type SendEventBroadcastRequest = z.infer<typeof SendEventBroadcastRequestSchema>

export const SendEventBroadcastResponseSchema = BroadcastDTOSchema
export type SendEventBroadcastResponse = z.infer<typeof SendEventBroadcastResponseSchema>

export const ScheduleEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema, scheduledAt: ISODateSchema })
  .strict()
export type ScheduleEventBroadcastRequest = z.infer<typeof ScheduleEventBroadcastRequestSchema>

export const ScheduleEventBroadcastResponseSchema = BroadcastDTOSchema
export type ScheduleEventBroadcastResponse = z.infer<typeof ScheduleEventBroadcastResponseSchema>

export const CancelEventBroadcastRequestSchema = z
  .object({ id: IdSchema, broadcastId: IdSchema })
  .strict()
export type CancelEventBroadcastRequest = z.infer<typeof CancelEventBroadcastRequestSchema>

export const CancelEventBroadcastResponseSchema = BroadcastDTOSchema
export type CancelEventBroadcastResponse = z.infer<typeof CancelEventBroadcastResponseSchema>

export const DeliverySuppressionReasonSchema = z.enum([
  "unsubscribed",
  "muted",
  "prefs_off",
  "stop_listed",
  "bounce_suppressed",
  "no_contact",
  "contact_scrubbed",
  "kill_switch",
  "banned",
  "deleted_user",
  "cap",
  "cancelled",
])
export type DeliverySuppressionReason = z.infer<typeof DeliverySuppressionReasonSchema>

export const DeliveryFailureKindSchema = z.enum([
  "transient",
  "permanent",
  "auth",
  "oversize",
  "unknown",
])
export type DeliveryFailureKind = z.infer<typeof DeliveryFailureKindSchema>

const BroadcastDeliveryDTOObjectSchema = z.object({
  id: IdSchema,
  channel: BroadcastChannelSchema,
  recipientKind: z.enum(["member", "guest"]),
  recipientLabel: z.string(),
  status: DeliveryStatusSchema,
  suppressionReason: DeliverySuppressionReasonSchema.nullable().optional(),
  failureKind: DeliveryFailureKindSchema.nullable().optional(),
  attempts: z.number().int().nonnegative().default(0),
  sentAt: ISODateSchema.nullable().optional(),
})
export type BroadcastDeliveryDTO = z.infer<typeof BroadcastDeliveryDTOObjectSchema>
export const BroadcastDeliveryDTOSchema: z.ZodType<BroadcastDeliveryDTO, z.ZodTypeDef, unknown> =
  BroadcastDeliveryDTOObjectSchema

export const ListBroadcastDeliveriesRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  broadcastId: IdSchema,
  status: DeliveryStatusSchema.optional(),
  channel: BroadcastChannelSchema.optional(),
}).strict()
export type ListBroadcastDeliveriesRequest = z.infer<typeof ListBroadcastDeliveriesRequestSchema>

const ListBroadcastDeliveriesResponseObjectSchema = pageResponse(BroadcastDeliveryDTOSchema)
export type ListBroadcastDeliveriesResponse = z.infer<typeof ListBroadcastDeliveriesResponseObjectSchema>
export const ListBroadcastDeliveriesResponseSchema: z.ZodType<ListBroadcastDeliveriesResponse, z.ZodTypeDef, unknown> =
  ListBroadcastDeliveriesResponseObjectSchema

export const UNSUBSCRIBE_TOKEN_MIN = 20
export const UNSUBSCRIBE_TOKEN_MAX = 512

export const UnsubscribeTokenSchema = z
  .string()
  .min(UNSUBSCRIBE_TOKEN_MIN)
  .max(UNSUBSCRIBE_TOKEN_MAX)

export const UnsubscribeBroadcastsRequestSchema = z
  .object({
    token: UnsubscribeTokenSchema,
  })
  .strict()
export type UnsubscribeBroadcastsRequest = z.infer<typeof UnsubscribeBroadcastsRequestSchema>

const UnsubscribeBroadcastsResponseObjectSchema = z.object({ ok: z.literal(true) })
export type UnsubscribeBroadcastsResponse = z.infer<typeof UnsubscribeBroadcastsResponseObjectSchema>
export const UnsubscribeBroadcastsResponseSchema: z.ZodType<UnsubscribeBroadcastsResponse, z.ZodTypeDef, unknown> =
  UnsubscribeBroadcastsResponseObjectSchema

export const OpenUnsubscribeBroadcastsRequestSchema = z
  .object({
    t: UnsubscribeTokenSchema,
  })
  .strict()
export type OpenUnsubscribeBroadcastsRequest = z.infer<typeof OpenUnsubscribeBroadcastsRequestSchema>

const OpenUnsubscribeBroadcastsResponseObjectSchema = z.object({}).strict()
export type OpenUnsubscribeBroadcastsResponse = z.infer<
  typeof OpenUnsubscribeBroadcastsResponseObjectSchema
>
export const OpenUnsubscribeBroadcastsResponseSchema: z.ZodType<
  OpenUnsubscribeBroadcastsResponse,
  z.ZodTypeDef,
  unknown
> = OpenUnsubscribeBroadcastsResponseObjectSchema

export const SetEventBroadcastMuteRequestSchema = z
  .object({ id: IdSchema, muted: z.boolean() })
  .strict()
export type SetEventBroadcastMuteRequest = z.infer<typeof SetEventBroadcastMuteRequestSchema>

const SetEventBroadcastMuteResponseObjectSchema = z.object({ muted: z.boolean() })
export type SetEventBroadcastMuteResponse = z.infer<typeof SetEventBroadcastMuteResponseObjectSchema>
export const SetEventBroadcastMuteResponseSchema: z.ZodType<SetEventBroadcastMuteResponse, z.ZodTypeDef, unknown> =
  SetEventBroadcastMuteResponseObjectSchema
