import { z } from "zod"
import { IdSchema, ISODateSchema, pageResponse, PushPlatformSchema } from "./common.js"
import { OkResponseSchema } from "./internal-fields.js"


export const NotificationTypeSchema = z.enum([
  "report_update",
  "cleanup_chat",
  "cleanup_reminder",
  "cleanup_cancelled",
  "new_follower",
  "claim_available",
  "dm",
  "system",
  "report_chat",
  "group_chat",
  "cleanup_role",
  "post_like",
  "post_repost",
  "post_reply",
  "post_quote",
  "post_mention",
  "cleanup_slot",
  "hours_logged",
  "event_broadcast",
  "event_team_invite",
  "org_invite",
])
export type NotificationType = z.infer<typeof NotificationTypeSchema>

export const NotificationDTOSchema = z.object({
  id: IdSchema,
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string().nullable().optional(),
  read: z.boolean(),
  createdAt: ISODateSchema,
  link: z.string().nullable().optional(),
})
export type NotificationDTO = z.infer<typeof NotificationDTOSchema>

export const ListNotificationsResponseSchema = pageResponse(NotificationDTOSchema)
export type ListNotificationsResponse = z.infer<typeof ListNotificationsResponseSchema>

export const MarkReadRequestSchema = z
  .object({
    ids: z.array(IdSchema),
  })
  .strict()
export type MarkReadRequest = z.infer<typeof MarkReadRequestSchema>

export const MarkReadResponseSchema = OkResponseSchema
export type MarkReadResponse = z.infer<typeof MarkReadResponseSchema>

export const QuietHoursSchema = z.object({
  start: z.string(),
  end: z.string(),
  tz: z.string().min(1).max(64).nullable().optional(),
})
export type QuietHours = z.infer<typeof QuietHoursSchema>

export const NotificationPrefsDTOSchema = z.object({
  push: z.boolean(),
  cleanupChat: z.boolean(),
  reportUpdates: z.boolean(),
  follows: z.boolean(),
  mentions: z.boolean(),
  postInteractions: z.boolean(),
  hostBroadcasts: z.boolean().default(true),
  quietHours: QuietHoursSchema.nullable().optional(),
})
export type NotificationPrefsDTO = z.infer<typeof NotificationPrefsDTOSchema>

export const GetNotificationPrefsResponseSchema = NotificationPrefsDTOSchema
export type GetNotificationPrefsResponse = z.infer<typeof GetNotificationPrefsResponseSchema>

export const UpdateNotificationPrefsRequestSchema = NotificationPrefsDTOSchema.partial().strict()
export type UpdateNotificationPrefsRequest = z.infer<typeof UpdateNotificationPrefsRequestSchema>

export const RegisterPushTokenRequestSchema = z
  .object({
    platform: PushPlatformSchema,
    token: z.string().min(1).max(2048),
    deviceId: z.string().optional(),
  })
  .strict()
export type RegisterPushTokenRequest = z.infer<typeof RegisterPushTokenRequestSchema>

export const RegisterPushTokenResponseSchema = OkResponseSchema
export type RegisterPushTokenResponse = z.infer<typeof RegisterPushTokenResponseSchema>

export const UnregisterPushTokenRequestSchema = z
  .object({
    platform: PushPlatformSchema,
    token: z.string().min(1).max(2048),
  })
  .strict()
export type UnregisterPushTokenRequest = z.infer<typeof UnregisterPushTokenRequestSchema>
