import { z } from "zod"
import { IdSchema, MESSAGE_BODY_MAX, pageResponse, ReportCategorySchema } from "../common.js"
import { ChatHistoryResponseSchema, ReportChatHistoryRequestSchema } from "../chat.js"
import type { ChatHistoryResponse, ReportChatHistoryRequest } from "../chat.js"
import { ChatMessageDTOSchema, LinkedEventRefSchema } from "../entities.js"
import {
  AdminActorRefSchema,
  AdminCoordsSchema,
  AdminReportStatusSchema,
  AdminListQuerySchema,
  RelAbsTimeSchema,
} from "./common.js"
import { AdminMediaRefSchema } from "./internal-fields.js"

/**
 * Admin reports surface. "flagged" is an abuse marker, not a status, and removing a report sets it to
 * `rejected`.
 */

/** A reporter reference. Anonymous reports have no account id and therefore no profile destination. */
export const ReportReporterSchema = AdminActorRefSchema.extend({ id: z.string().nullable() }).strict()
export type ReportReporter = z.infer<typeof ReportReporterSchema>

/** A report-detail timeline entry (who did what, when, with an icon kind). */
export const ReportTimelineItemSchema = z
  .object({
    who: z.string(),
    what: z.string(),
    when: z.string(),
    // `reply` = an inbound jurisdiction reply surfaced on the report (the city responded to an outreach).
    kind: z.enum([
      "submit",
      "route",
      "confirm",
      "status",
      "done",
      "warn",
      "followup",
      "remove",
      "reply",
    ]),
  })
  .strict()
export type ReportTimelineItem = z.infer<typeof ReportTimelineItemSchema>

/** Where a report routed: the city department, place label, and the contact (null if none on file). */
export const ReportRoutingSchema = z
  .object({
    dept: z.string(),
    place: z.string(),
    contact: z.string().email().nullable(),
    routed: z.boolean(),
  })
  .strict()
export type ReportRouting = z.infer<typeof ReportRoutingSchema>

/**
 * The outreach lifecycle of a report's email to its jurisdiction. Orthogonal to the report status
 * (which tracks the civic resolution), this tracks the email itself:
 *   not_sent  - never emailed to the jurisdiction.
 *   sent      - the outreach email was delivered to the relay (no further signal yet).
 *   delivered - the receiving server accepted it (a `delivered` mail_event).
 *   replied   - the jurisdiction replied (an inbound message threaded back onto this report).
 *   bounced   - the outreach hard-bounced (the contact address is dead).
 */
export const ReportOutreachStatusSchema = z.enum([
  "not_sent",
  "sent",
  "delivered",
  "replied",
  "bounced",
])
export type ReportOutreachStatus = z.infer<typeof ReportOutreachStatusSchema>

/** The report's outreach state + a deep-link to its per-report mail thread. */
export const ReportOutreachSchema = z
  .object({
    status: ReportOutreachStatusSchema,
    /** The per-report mail thread id (so the admin can open the city conversation), or null. */
    threadId: z.string().nullable(),
    /** The address the report was sent to (the jurisdiction's contact on file), or null. */
    routedTo: z.string().email().nullable(),
    /** ISO timestamp of the (first) send to the jurisdiction, or null. */
    routedAt: z.string().nullable(),
    /** True when the latest send attempt was rejected by the mail provider; a resend is allowed. */
    sendFailed: z.boolean().optional(),
  })
  .strict()
export type ReportOutreach = z.infer<typeof ReportOutreachSchema>

/** A media asset on a report (image/video reference; the real media URL, not a placeholder). */
export const ReportMediaSchema = AdminMediaRefSchema
export type ReportMedia = z.infer<typeof ReportMediaSchema>

/**
 * A report list row. `status` is the civfix report status; `flagged` is the orthogonal abuse marker.
 * `confirmations` is the count of report_follows. `submitted` carries both the relative and absolute
 * timestamp. `hasPhoto` drives the "photo attached" affordance without sending media on the list;
 * `thumbnailUrl` is a presigned preview of the report's first ready image (the pipeline thumbnail when
 * one exists, else the served image), so a row can show the photo in place of the category pin. It is
 * null for a report with no usable image, and defaulted so an older server's response still parses.
 */
export const AdminReportListItemDTOSchema = z
  .object({
    id: z.string(),
    category: ReportCategorySchema,
    status: AdminReportStatusSchema,
    flagged: z.boolean(),
    title: z.string(),
    place: z.string(),
    reporter: ReportReporterSchema,
    confirmations: z.number().int().nonnegative(),
    submitted: RelAbsTimeSchema,
    coords: AdminCoordsSchema,
    address: z.string(),
    hasPhoto: z.boolean(),
    thumbnailUrl: z.string().nullable().default(null),
  })
  .strict()
export type AdminReportListItemDTO = z.infer<typeof AdminReportListItemDTOSchema>

/**
 * Report list query: search matches title/place/id/reporter; `filter` is the status+flag facet.
 * `needs_verification` is the review queue: reports with no verification verdict yet, orthogonal to
 * the civic status.
 */
export const AdminReportListQuerySchema = AdminListQuerySchema.extend({
  filter: z
    .enum(["all", "submitted", "in_progress", "completed", "flagged", "needs_verification"])
    .optional(),
})
export type AdminReportListQuery = z.infer<typeof AdminReportListQuerySchema>

/**
 * Per-bucket totals for the filter chips, computed server-side over the SEARCHED set (so the chip numbers
 * are accurate + stable across the status facet rather than capped to the first keyset page). `all` is the
 * sum of the three live buckets (submitted|in_progress|completed); `flagged` is the orthogonal abuse count.
 */
export const AdminReportCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    flagged: z.number().int().nonnegative(),
    needsVerification: z.number().int().nonnegative().optional(),
  })
  .strict()
export type AdminReportCounts = z.infer<typeof AdminReportCountsSchema>

export const AdminReportListResponseSchema = pageResponse(AdminReportListItemDTOSchema).extend({
  counts: AdminReportCountsSchema,
})
export type AdminReportListResponse = z.infer<typeof AdminReportListResponseSchema>

/** Full report detail: the list shape plus description, timeline, routing, and media assets. */
export const AdminReportDTOSchema = AdminReportListItemDTOSchema.extend({
  desc: z.string(),
  timeline: z.array(ReportTimelineItemSchema),
  city: ReportRoutingSchema,
  media: z.array(ReportMediaSchema),
  // Events (cleanups) this report is linked to. Defaulted so an older server's response still parses.
  linkedEvents: z.array(LinkedEventRefSchema).default([]),
  // The resolved jurisdiction GEOID, so the admin can deep-link to that jurisdiction's routing contact.
  // Defaulted so an older server's response still parses.
  geoid: z.string().nullable().default(null),
  // Defaulted to "not_sent" so an older server's response still parses.
  outreach: ReportOutreachSchema.default({
    status: "not_sent",
    threadId: null,
    routedTo: null,
    routedAt: null,
  }),
  // Immutable human reference (e.g. "DU-42-000001"). Optional so older servers and un-migrated rows
  // still parse.
  referenceCode: z.string().optional(),
  // The operator's verification verdict, orthogonal to the civic status; null means no verdict yet.
  // Nullish so older servers still parse.
  verificationVerdict: z.enum(["approved", "rejected"]).nullish(),
  // ISO timestamp of the verdict. Nullish so older servers and un-reviewed reports still parse.
  verifiedAt: z.string().nullish(),
  // Whether the REPORTER has earned the report-verified state. Optional so older servers still parse.
  reporterReportVerified: z.boolean().optional(),
}).strict()
export type AdminReportDTO = z.infer<typeof AdminReportDTOSchema>

export const GetAdminReportResponseSchema = AdminReportDTOSchema
export type GetAdminReportResponse = z.infer<typeof GetAdminReportResponseSchema>

/** Set the report status from the quick-status buttons (writes report_timeline; audited). */
export const SetReportStatusRequestSchema = z
  .object({
    id: z.string(),
    status: AdminReportStatusSchema,
  })
  .strict()
export type SetReportStatusRequest = z.infer<typeof SetReportStatusRequestSchema>

export const FlagReportRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagReportRequest = z.infer<typeof FlagReportRequestSchema>

/** Remove a report: sets it to `rejected` (a soft delete). */
export const RemoveReportRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type RemoveReportRequest = z.infer<typeof RemoveReportRequestSchema>

/** Send a follow-up to the reporter or the routed city contact. */
export const SendFollowupRequestSchema = z
  .object({
    id: z.string(),
    to: z.enum(["reporter", "city"]),
    body: z.string().min(1).max(4000),
  })
  .strict()
export type SendFollowupRequest = z.infer<typeof SendFollowupRequestSchema>

/**
 * Approve a report and email it to its jurisdiction. Sends the full
 * report packet (details + photos) to the jurisdiction's resolved routing contact, opens/reuses a
 * per-report mail thread (so the city's reply auto-routes back onto this report), and advances the
 * report toward `acknowledged` when it is still in a pre-routed status. Fails 422 (NOT_ROUTABLE) when
 * the jurisdiction has no routing contact on file - there is no one-off destination; set the contact in
 * Jurisdictions first.
 */
export const RouteReportRequestSchema = z
  .object({
    id: z.string(),
    /** Optional operator note included in the email packet + the report timeline. */
    note: z.string().max(4000).optional(),
  })
  .strict()
export type RouteReportRequest = z.infer<typeof RouteReportRequestSchema>

/** The result of routing a report: the per-report thread it landed in + the address it was sent to. */
export const RouteReportResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    routedTo: z.string().email(),
  })
  .strict()
export type RouteReportResponse = z.infer<typeof RouteReportResponseSchema>

/**
 * Set a report's verification verdict, orthogonal to the civic status. `id` fills the `:id` path param.
 * An `approved` verdict that gives the reporter two or more approved reports earns them report-verified
 * (recomputed server-side).
 */
export const SetReportVerdictRequestSchema = z
  .object({
    id: z.string(),
    verdict: z.enum(["approved", "rejected"]),
  })
  .strict()
export type SetReportVerdictRequest = z.infer<typeof SetReportVerdictRequestSchema>

export const SetReportVerdictResponseSchema = z.object({ ok: z.literal(true) }).strict()
export type SetReportVerdictResponse = z.infer<typeof SetReportVerdictResponseSchema>

export const AdminReportMessagesRequestSchema = ReportChatHistoryRequestSchema
export type AdminReportMessagesRequest = ReportChatHistoryRequest

export const AdminReportMessagesResponseSchema = ChatHistoryResponseSchema
export type AdminReportMessagesResponse = ChatHistoryResponse

export const AdminSendReportMessageRequestSchema = z
  .object({
    id: IdSchema,
    body: z.string().min(1).max(MESSAGE_BODY_MAX),
  })
  .strict()
export type AdminSendReportMessageRequest = z.infer<typeof AdminSendReportMessageRequestSchema>

export const AdminSendReportMessageResponseSchema = z
  .object({ message: ChatMessageDTOSchema })
  .strict()
export type AdminSendReportMessageResponse = z.infer<typeof AdminSendReportMessageResponseSchema>

export const AdminRemoveReportMessageRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
    reason: z.string().max(500).optional(),
  })
  .strict()
export type AdminRemoveReportMessageRequest = z.infer<typeof AdminRemoveReportMessageRequestSchema>
