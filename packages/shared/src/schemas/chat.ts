import { z } from "zod"
import { IdSchema, pageResponse } from "./common.js"
import { ChatMessageDTOSchema, PersonDTOSchema, ReactionEmojiSchema } from "./entities.js"
import { MESSAGE_BODY_MAX, RoomKindSchema } from "../types/ws.js"


export { ChatMessageDTOSchema, ChatMessageKindSchema } from "./entities.js"
export type { ChatMessageDTO, ChatMessageKind } from "./entities.js"

export const rejectAroundWithBefore = (
  v: { before?: string; around?: string },
  ctx: z.RefinementCtx,
): void => {
  if (v.before !== undefined && v.around !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["around"],
      message: "`around` and `before` are mutually exclusive",
    })
  }
}

export const ChatHistoryQueryShape = z.object({
  before: IdSchema.optional(),
  around: IdSchema.optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
})
export const ChatHistoryQuerySchema = ChatHistoryQueryShape.superRefine(rejectAroundWithBefore)
export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>

export const ChatHistoryRequestSchema = ChatHistoryQueryShape.extend({
  cleanupId: IdSchema,
})
  .strict()
  .superRefine(rejectAroundWithBefore)
export type ChatHistoryRequest = z.infer<typeof ChatHistoryRequestSchema>

export const ChatHistoryResponseSchema = pageResponse(ChatMessageDTOSchema).extend({
  prevCursor: z.string().nullable().optional(),
  pins: z.array(ChatMessageDTOSchema).optional(),
})
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>

export const MessageThreadDTOSchema = z.object({
  id: IdSchema,
  kind: z.enum(["cleanup", "dm", "group", "report"]),
  title: z.string(),
  last: z.string().nullable().optional(),
  ago: z.string().nullable().optional(),
  lastMessageAt: z.string().datetime().nullable().optional(),
  refId: z.string().nullable().optional(),
  peer: PersonDTOSchema.nullable().optional(),
  lastFromMe: z.boolean().optional().default(false),
  unread: z.number().int().nonnegative(),
  members: z.number().int().nonnegative(),
  muted: z.boolean().optional().default(false),
  channel: z.boolean().optional(),
})
export type MessageThreadDTO = z.infer<typeof MessageThreadDTOSchema>

export const ListThreadsResponseSchema = pageResponse(MessageThreadDTOSchema)
export type ListThreadsResponse = z.infer<typeof ListThreadsResponseSchema>

export const MarkThreadReadRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
  })
  .strict()
export type MarkThreadReadRequest = z.infer<typeof MarkThreadReadRequestSchema>

export const MarkThreadReadResponseSchema = z.object({ ok: z.literal(true) })
export type MarkThreadReadResponse = z.infer<typeof MarkThreadReadResponseSchema>


export const OpenDmRequestSchema = z.object({ userId: IdSchema }).strict()
export type OpenDmRequest = z.infer<typeof OpenDmRequestSchema>

export const OpenDmResponseSchema = z.object({ thread: MessageThreadDTOSchema })
export type OpenDmResponse = z.infer<typeof OpenDmResponseSchema>

export const DmHistoryQuerySchema = ChatHistoryQueryShape.superRefine(rejectAroundWithBefore)
export type DmHistoryQuery = z.infer<typeof DmHistoryQuerySchema>

export const DmHistoryRequestSchema = ChatHistoryQueryShape.extend({
  threadId: IdSchema,
})
  .strict()
  .superRefine(rejectAroundWithBefore)
export type DmHistoryRequest = z.infer<typeof DmHistoryRequestSchema>

export const DmHistoryResponseSchema = ChatHistoryResponseSchema
export type DmHistoryResponse = z.infer<typeof DmHistoryResponseSchema>

export const EditChatMessageRequestSchema = z
  .object({
    threadId: IdSchema,
    messageId: IdSchema,
    body: z.string().min(1).max(MESSAGE_BODY_MAX),
    mentionedUserIds: z.array(IdSchema).max(20).optional(),
  })
  .strict()
export type EditChatMessageRequest = z.infer<typeof EditChatMessageRequestSchema>

export const EditMessageRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    messageId: IdSchema,
    body: z.string().min(1).max(MESSAGE_BODY_MAX),
    mentionedUserIds: z.array(IdSchema).max(20).optional(),
  })
  .strict()
export type EditMessageRequest = z.infer<typeof EditMessageRequestSchema>

export const SetMessagePinnedRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    messageId: IdSchema,
    pinned: z.boolean(),
  })
  .strict()
export type SetMessagePinnedRequest = z.infer<typeof SetMessagePinnedRequestSchema>

export const ToggleMessageReactionRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    messageId: IdSchema,
    emoji: ReactionEmojiSchema,
  })
  .strict()
export type ToggleMessageReactionRequest = z.infer<typeof ToggleMessageReactionRequestSchema>

export const DeleteDmMessageRequestSchema = z
  .object({
    threadId: IdSchema,
    messageId: IdSchema,
  })
  .strict()
export type DeleteDmMessageRequest = z.infer<typeof DeleteDmMessageRequestSchema>

export const DeleteCleanupMessageRequestSchema = z
  .object({
    cleanupId: IdSchema,
    messageId: IdSchema,
  })
  .strict()
export type DeleteCleanupMessageRequest = z.infer<typeof DeleteCleanupMessageRequestSchema>

export const ToggleCleanupMessageReactionRequestSchema = z
  .object({
    cleanupId: IdSchema,
    messageId: IdSchema,
    emoji: ReactionEmojiSchema,
  })
  .strict()
export type ToggleCleanupMessageReactionRequest = z.infer<
  typeof ToggleCleanupMessageReactionRequestSchema
>

export const ToggleDmMessageReactionRequestSchema = z
  .object({
    threadId: IdSchema,
    messageId: IdSchema,
    emoji: ReactionEmojiSchema,
  })
  .strict()
export type ToggleDmMessageReactionRequest = z.infer<typeof ToggleDmMessageReactionRequestSchema>

export const ReportChatHistoryRequestSchema = ChatHistoryQueryShape.extend({
  id: IdSchema,
})
  .strict()
  .superRefine(rejectAroundWithBefore)
export type ReportChatHistoryRequest = z.infer<typeof ReportChatHistoryRequestSchema>

export const DeleteReportMessageRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
  })
  .strict()
export type DeleteReportMessageRequest = z.infer<typeof DeleteReportMessageRequestSchema>

export const ToggleReportMessageReactionRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
    emoji: ReactionEmojiSchema,
  })
  .strict()
export type ToggleReportMessageReactionRequest = z.infer<
  typeof ToggleReportMessageReactionRequestSchema
>


export const PollRoomKindSchema = z.enum(["cleanup", "report", "group"])
export type PollRoomKind = z.infer<typeof PollRoomKindSchema>

export const CreatePollRequestSchema = z
  .object({
    roomKind: PollRoomKindSchema,
    roomId: IdSchema,
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(100)).min(2).max(10),
    allowMultiple: z.boolean().default(false),
    anonymous: z.boolean().default(true),
  })
  .strict()
export type CreatePollRequest = z.infer<typeof CreatePollRequestSchema>

export const VotePollRequestSchema = z
  .object({
    messageId: IdSchema,
    optionIdxs: z.array(z.number().int().min(0).max(9)).max(10),
  })
  .strict()
export type VotePollRequest = z.infer<typeof VotePollRequestSchema>

export const ClosePollRequestSchema = z.object({ messageId: IdSchema }).strict()
export type ClosePollRequest = z.infer<typeof ClosePollRequestSchema>
