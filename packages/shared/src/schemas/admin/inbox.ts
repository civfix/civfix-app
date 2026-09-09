import { z } from "zod"
import { pageResponse } from "../common.js"
import { AdminListQuerySchema } from "./common.js"
import { MailAttachmentSchema } from "./mail.js"

/**
 * Inbox: catch-all `*@civfix.org` inbound mail that is NOT an outreach reply (a reply carries a
 * `reply+{token}@` thread token and threads into the Mail feature instead). These are cold/support
 * messages stored in the backend `inbound_emails` table and triaged in the admin Inbox feature
 * (list + reader, mark read / archive). The Cloudflare Email Worker -> R2 -> backend webhook/sweep
 * pipeline writes them; see documents/17-inbound-email-worker.md.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Lifecycle of an inbound email in the operator inbox. */
export const InboundEmailStatusSchema = z.enum(["unread", "read", "archived"])
export type InboundEmailStatus = z.infer<typeof InboundEmailStatusSchema>

export const INBOUND_EMAIL_STATUS_LABELS: Record<InboundEmailStatus, string> = {
  unread: "Unread",
  read: "Read",
  archived: "Archived",
}

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Set an inbound email's triage status ("Mark read" -> read, "Archive" -> archived). */
export const SetInboxStatusRequestSchema = z
  .object({
    id: z.string(),
    status: InboundEmailStatusSchema,
  })
  .strict()
export type SetInboxStatusRequest = z.infer<typeof SetInboxStatusRequestSchema>
