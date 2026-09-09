import { z } from "zod"
import { pageResponse } from "../common.js"
import { AdminListQuerySchema, MailDirectionSchema, MailStatusSchema } from "./common.js"



export const MailAttachmentSchema = z
  .object({
    key: z.string(),
    filename: z.string(),
    size: z.number().int().nonnegative(),
  })
  .strict()
export type MailAttachment = z.infer<typeof MailAttachmentSchema>

export const MailMessageDTOSchema = z
  .object({
    id: z.string(),
    who: z.string(),
    from: z.string(),
    to: z.string(),
    dir: MailDirectionSchema,
    body: z.string(),
    ts: z.string(),
    attachments: z.array(MailAttachmentSchema),
    // Set when the backend truncated a long mail body. Optional; schema is .strict() so it must be declared.
    truncated: z.boolean().optional(),
  })
  .strict()
export type MailMessageDTO = z.infer<typeof MailMessageDTOSchema>


export const MailThreadListItemDTOSchema = z
  .object({
    id: z.string(),
    dir: MailDirectionSchema,
    from: z.string(),
    to: z.string(),
    org: z.string(),
    subject: z.string(),
    preview: z.string(),
    ts: z.string(),
    unread: z.boolean(),
    status: MailStatusSchema,
    jurisdictionGeoid: z.string().nullable(),
    // The originating report id (the report whose forward started this thread), for the reverse
    // mail -> report link. Null when the thread has no associated report. Inherited by MailThreadDTO.
    reportId: z.string().nullable(),
  })
  .strict()
export type MailThreadListItemDTO = z.infer<typeof MailThreadListItemDTOSchema>

export const MailListQuerySchema = AdminListQuerySchema.extend({
  dir: MailDirectionSchema.optional(),
  filter: z.enum(["all", "attn"]).optional(),
  geoid: z.string().optional(),
})
export type MailListQuery = z.infer<typeof MailListQuerySchema>

export const MailListResponseSchema = pageResponse(MailThreadListItemDTOSchema)
export type MailListResponse = z.infer<typeof MailListResponseSchema>


export const MailThreadDTOSchema = MailThreadListItemDTOSchema.extend({
  messages: z.array(MailMessageDTOSchema),
}).strict()
export type MailThreadDTO = z.infer<typeof MailThreadDTOSchema>

export const GetMailThreadResponseSchema = MailThreadDTOSchema
export type GetMailThreadResponse = z.infer<typeof GetMailThreadResponseSchema>


export const MailStatsResponseSchema = z
  .object({
    unread: z.number().int().nonnegative(),
    threads: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    bounced: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .strict()
export type MailStatsResponse = z.infer<typeof MailStatsResponseSchema>


export const ComposeRequestSchema = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20000),
  })
  .strict()
export type ComposeRequest = z.infer<typeof ComposeRequestSchema>

export const ReplyRequestSchema = z
  .object({
    id: z.string(),
    body: z.string().min(1).max(20000),
  })
  .strict()
export type ReplyRequest = z.infer<typeof ReplyRequestSchema>

export const MarkMailReadRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict()
export type MarkMailReadRequest = z.infer<typeof MarkMailReadRequestSchema>

export const SetMailStatusRequestSchema = z
  .object({
    id: z.string(),
    status: MailStatusSchema,
  })
  .strict()
export type SetMailStatusRequest = z.infer<typeof SetMailStatusRequestSchema>

export const ResendRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict()
export type ResendRequest = z.infer<typeof ResendRequestSchema>
