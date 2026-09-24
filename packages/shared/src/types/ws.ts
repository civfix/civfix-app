import { z } from "zod"
import { IdSchema, MESSAGE_BODY_MAX, RoomKindSchema } from "../schemas/common.js"
import { ChatMessageDTOSchema, ChatMessageKindSchema } from "../schemas/entities.js"
import { MAX_MENTIONED_USERS } from "../schemas/internal-fields.js"

export { MESSAGE_BODY_MAX, RoomKindSchema } from "../schemas/common.js"
export type { RoomKind } from "../schemas/common.js"

const MAX_MESSAGE_MEDIA_UPLOADS = 5

export const EDIT_WINDOW_HOURS = 48

export const SignalTopicSchema = z.enum([
  "notifications",
  "threads",
  "reports",
  "host",
  "feed",
  "feed_counts",
])
export type SignalTopic = z.infer<typeof SignalTopicSchema>

export const UserSignalSchema = z
  .object({ topic: SignalTopicSchema, id: IdSchema.optional() })
  .strict()
export type UserSignal = z.infer<typeof UserSignalSchema>


export const WsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), cleanupId: IdSchema, roomKind: RoomKindSchema.optional() }),
  z.object({ type: z.literal("leave"), cleanupId: IdSchema, roomKind: RoomKindSchema.optional() }),
  z.object({
    type: z.literal("send"),
    cleanupId: IdSchema,
    roomKind: RoomKindSchema.optional(),
    clientId: z.string().min(1).max(64),
    body: z.string().max(MESSAGE_BODY_MAX),
    kind: ChatMessageKindSchema.optional(),
    mentionedUserIds: z.array(IdSchema).max(MAX_MENTIONED_USERS).optional(),
    mediaUploadIds: z.array(IdSchema).max(MAX_MESSAGE_MEDIA_UPLOADS).optional(),
    replyToId: IdSchema.optional(),
  }),
  z.object({ type: z.literal("typing"), cleanupId: IdSchema, roomKind: RoomKindSchema.optional() }),
  z.object({
    type: z.literal("ack"),
    upToId: IdSchema,
    cleanupId: IdSchema.optional(),
    roomKind: RoomKindSchema.optional(),
  }),
])
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>


export const WsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), message: ChatMessageDTOSchema }),
  z.object({
    type: z.literal("reaction"),
    cleanupId: IdSchema,
    roomKind: RoomKindSchema.optional(),
    message: ChatMessageDTOSchema,
  }),
  z.object({
    type: z.literal("presence"),
    cleanupId: IdSchema,
    roomKind: RoomKindSchema.optional(),
    userId: IdSchema,
    state: z.enum(["join", "leave"]),
  }),
  z.object({
    type: z.literal("presence_snapshot"),
    cleanupId: IdSchema,
    roomKind: RoomKindSchema.optional(),
    userIds: z.array(IdSchema),
  }),
  z.object({
    type: z.literal("typing"),
    cleanupId: IdSchema,
    roomKind: RoomKindSchema.optional(),
    userId: IdSchema,
  }),
  z.object({ type: z.literal("signal"), ...UserSignalSchema.shape }),
  z.object({
    type: z.literal("discussion"),
    reportId: IdSchema,
    event: z.enum(["message", "reply", "reaction", "remove"]),
  }),
  z.object({
    type: z.literal("message_update"),
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    message: ChatMessageDTOSchema,
  }),
  z.object({ type: z.literal("ack"), clientId: z.string(), message: ChatMessageDTOSchema }),
  z.object({
    type: z.literal("error"),
    code: z.string(),
    message: z.string(),
    cleanupId: IdSchema.optional(),
    roomKind: RoomKindSchema.optional(),
  }),
])
export type WsServerMessage = z.infer<typeof WsServerMessageSchema>
