import { z } from "zod"
import { pageResponse } from "../common.js"
import {
  AdminListQuerySchema,
  MailAuthVerdictSchema,
  MailReplyPublicationSchema,
  MailStatusSchema,
} from "./common.js"
import { MailAttachmentSchema } from "./mail.js"

/**
 * Inbox: catch-all `*@civfix.org` inbound mail that is NOT an outreach reply (a reply carries a
 * `reply+{token}@` thread token and threads into Mail instead). The Cloudflare Email Worker -> R2 ->
 * backend webhook/sweep pipeline writes them to the `inbound_emails` table.
 */

/** Lifecycle of an inbound email in the operator inbox. */
export const InboundEmailStatusSchema = z.enum(["unread", "read", "archived"])
export type InboundEmailStatus = z.infer<typeof InboundEmailStatusSchema>

export const INBOUND_EMAIL_STATUS_LABELS: Record<InboundEmailStatus, string> = {
  unread: "Unread",
  read: "Read",
  archived: "Archived",
}

/**
 * An inbox list row. `from` is the sender address; `recipient` the full catch-all address it was sent
 * to (e.g. support@civfix.org); `localPart` the part before the @ (drives the recipient facet);
 * `preview` an excerpt of the body; `unread` styles the row; `status` the triage state.
 */
export const InboundEmailListItemDTOSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    recipient: z.string(),
    localPart: z.string(),
    subject: z.string(),
    preview: z.string(),
    ts: z.string(),
    status: InboundEmailStatusSchema,
    unread: z.boolean(),
    hasAttachments: z.boolean(),
    authVerdict: MailAuthVerdictSchema.nullable().optional(),
  })
  .strict()
export type InboundEmailListItemDTO = z.infer<typeof InboundEmailListItemDTOSchema>

/**
 * Inbox list query: `status` filters the triage state (`all` is the default, no filter); `localPart`
 * scopes to one catch-all recipient; search matches from/subject. Non-strict (extends the base GET
 * query) so an echoed param still parses.
 */
export const InboxListQuerySchema = AdminListQuerySchema.extend({
  status: z.enum(["all", "unread", "archived"]).optional(),
  localPart: z.string().optional(),
})
export type InboxListQuery = z.infer<typeof InboxListQuerySchema>

export const InboxListResponseSchema = pageResponse(InboundEmailListItemDTOSchema)
export type InboxListResponse = z.infer<typeof InboxListResponseSchema>

/** Full inbound email: the list shape plus the body + attachment refs (single message, not a thread). */
export const InboundEmailDTOSchema = InboundEmailListItemDTOSchema.extend({
  bodyText: z.string(),
  bodyHtml: z.string().nullable(),
  messageId: z.string().nullable(),
  attachments: z.array(MailAttachmentSchema),
}).strict()
export type InboundEmailDTO = z.infer<typeof InboundEmailDTOSchema>

export const GetInboxMessageResponseSchema = InboundEmailDTOSchema
export type GetInboxMessageResponse = z.infer<typeof GetInboxMessageResponseSchema>

/** Set an inbound email's triage status. */
export const SetInboxStatusRequestSchema = z
  .object({
    id: z.string(),
    status: InboundEmailStatusSchema,
  })
  .strict()
export type SetInboxStatusRequest = z.infer<typeof SetInboxStatusRequestSchema>

export const InboxFeedFilterSchema = z.enum(["all", "unread", "replies", "review", "unmatched", "archived"])
export type InboxFeedFilter = z.infer<typeof InboxFeedFilterSchema>

export const INBOX_FEED_FILTER_LABELS: Record<InboxFeedFilter, string> = {
  all: "All",
  unread: "Unread",
  replies: "Replies",
  review: "Needs review",
  unmatched: "Unmatched",
  archived: "Archived",
}

export const InboxFeedQuerySchema = AdminListQuerySchema.extend({
  filter: InboxFeedFilterSchema.optional(),
})
export type InboxFeedQuery = z.infer<typeof InboxFeedQuerySchema>

export const InboxFeedEmailItemDTOSchema = InboundEmailListItemDTOSchema.extend({
  source: z.literal("email"),
}).strict()
export type InboxFeedEmailItemDTO = z.infer<typeof InboxFeedEmailItemDTOSchema>

export const InboxFeedReplyItemDTOSchema = z
  .object({
    source: z.literal("reply"),
    id: z.string(),
    threadId: z.string(),
    reportId: z.string().nullable(),
    cleanupId: z.string().nullable(),
    org: z.string(),
    from: z.string(),
    subject: z.string(),
    preview: z.string(),
    ts: z.string(),
    unread: z.boolean(),
    threadStatus: MailStatusSchema,
    hasAttachments: z.boolean(),
    authVerdict: MailAuthVerdictSchema.nullable(),
    publication: MailReplyPublicationSchema.nullable(),
  })
  .strict()
export type InboxFeedReplyItemDTO = z.infer<typeof InboxFeedReplyItemDTOSchema>

export const InboxFeedItemDTOSchema = z.discriminatedUnion("source", [
  InboxFeedEmailItemDTOSchema,
  InboxFeedReplyItemDTOSchema,
])
export type InboxFeedItemDTO = z.infer<typeof InboxFeedItemDTOSchema>

export const InboxFeedResponseSchema = pageResponse(InboxFeedItemDTOSchema)
export type InboxFeedResponse = z.infer<typeof InboxFeedResponseSchema>
