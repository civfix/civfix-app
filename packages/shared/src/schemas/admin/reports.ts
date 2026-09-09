import { z } from "zod"
import { ReportCategorySchema } from "../common.js"
import { pageResponse } from "../common.js"
import { LinkedEventRefSchema } from "../entities.js"
import {
  AdminActorRefSchema,
  AdminCoordsSchema,
  AdminReportStatusSchema,
  AdminListQuerySchema,
  RelAbsTimeSchema,
} from "./common.js"

/**
 * Admin reports surface: every neighbor report routed to a city department. List (filter by civfix
 * status + flagged + search), detail (desc, timeline, reporter, routing, media), and the operator
 * actions: set status, flag/unflag, remove (-> rejected), send a follow-up to the reporter or city.
 * Reconciliation: design submitted|in-progress|completed -> civfix submitted|in_progress|resolved;
 * "flagged" is an abuse marker, not a status; "Remove" -> rejected. See enumeration 2.C.
 */

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

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
    /** The address the report was sent to (the resolved or overridden contact), or null. */
    routedTo: z.string().email().nullable(),
    /** ISO timestamp of the (first) send to the jurisdiction, or null. */
    routedAt: z.string().nullable(),
  })
  .strict()
export type ReportOutreach = z.infer<typeof ReportOutreachSchema>

/** A media asset on a report (image/video reference; the real media URL, not a placeholder). */
export const ReportMediaSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["image", "video"]),
    url: z.string(),
    thumbUrl: z.string().nullable().optional(),
  })
  .strict()
export type ReportMedia = z.infer<typeof ReportMediaSchema>

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

/**
 * A report list row. `status` is the civfix report status; `flagged` is the orthogonal abuse marker.
 * `confirmations` is the count of report_follows. `submitted` carries both the relative and absolute
 * timestamp. `hasPhoto` drives the "photo attached" affordance without sending media on the list.
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
  })
  .strict()
export type AdminReportListItemDTO = z.infer<typeof AdminReportListItemDTOSchema>

/**
 * Report list query: search matches title/place/id/reporter; `filter` is the status+flag facet the
 * design shows (all|submitted|in_progress|completed|flagged).
 */
export const AdminReportListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "submitted", "in_progress", "completed", "flagged"]).optional(),
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
  })
  .strict()
export type AdminReportCounts = z.infer<typeof AdminReportCountsSchema>

export const AdminReportListResponseSchema = pageResponse(AdminReportListItemDTOSchema).extend({
  counts: AdminReportCountsSchema,
})
export type AdminReportListResponse = z.infer<typeof AdminReportListResponseSchema>

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** Full report detail: the list shape plus description, timeline, routing, and media assets. */
export const AdminReportDTOSchema = AdminReportListItemDTOSchema.extend({
  desc: z.string(),
  timeline: z.array(ReportTimelineItemSchema),
  city: ReportRoutingSchema,
  media: z.array(ReportMediaSchema),
  // Events (cleanups) this report is linked to (its "linked events" gallery; reuses the shared light
  // ref from entities). Defaults to [] so a server that does not yet supply it, and older consumers, parse.
  linkedEvents: z.array(LinkedEventRefSchema).default([]),
  // The report's resolved jurisdiction GEOID (lets the admin deep-link to the Jurisdictions row to edit
  // its routing contact). Nullable + defaulted so older servers / first-deploy responses still parse.
  geoid: z.string().nullable().default(null),
  // The outreach lifecycle (was it emailed to the jurisdiction, did they reply/bounce) + the per-report
  // mail thread link. Defaulted to "not_sent" so older servers / first-deploy responses still parse.
  outreach: ReportOutreachSchema.default({
    status: "not_sent",
    threadId: null,
    routedTo: null,
    routedAt: null,
  }),
  // Immutable human reference (e.g. "DU-42-000001"). Optional + additive so older servers / un-migrated
  // rows still parse.
  referenceCode: z.string().optional(),
  // The report-verification verdict an operator set (Approve/Reject buttons), orthogonal to the civic
  // status. Nullish + additive so older servers / un-reviewed reports still parse; null => no verdict yet.
  verificationVerdict: z.enum(["approved", "rejected"]).nullish(),
  // ISO timestamp of the verdict. Nullish (matching the ISO-string convention used by outreach.routedAt)
  // so older servers / un-reviewed reports still parse.
  verifiedAt: z.string().nullish(),
  // Whether the REPORTER has earned the report-verified state (lets admin surface it on the report).
  // Optional + additive so older servers still parse.
  reporterReportVerified: z.boolean().optional(),
}).strict()
export type AdminReportDTO = z.infer<typeof AdminReportDTOSchema>

export const GetAdminReportResponseSchema = AdminReportDTOSchema
export type GetAdminReportResponse = z.infer<typeof GetAdminReportResponseSchema>

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Set the report status from the quick-status buttons (writes report_timeline; audited). */
export const SetReportStatusRequestSchema = z
  .object({
    id: z.string(),
    status: AdminReportStatusSchema,
  })
  .strict()
export type SetReportStatusRequest = z.infer<typeof SetReportStatusRequestSchema>

/** Flag / unflag a report ("Flag"/"Flagged" toggle). */
export const FlagReportRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type FlagReportRequest = z.infer<typeof FlagReportRequestSchema>

/** Remove a report ("Remove report" -> rejected / soft-delete). */
export const RemoveReportRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type RemoveReportRequest = z.infer<typeof RemoveReportRequestSchema>

/** Send a follow-up to the reporter or the routed city contact ("Send a follow-up"). */
export const SendFollowupRequestSchema = z
  .object({
    id: z.string(),
    to: z.enum(["reporter", "city"]),
    body: z.string().min(1).max(4000),
  })
  .strict()
export type SendFollowupRequest = z.infer<typeof SendFollowupRequestSchema>

/**
 * Approve a report and email it to its jurisdiction ("Approve & send to jurisdiction"). Sends the full
 * report packet (details + photos) to the resolved routing contact - or to `contactEmailOverride` when
 * the operator types a one-off address - opens/reuses a per-report mail thread (so the city's reply
 * auto-routes back onto this report), and advances the report toward `acknowledged`. Fails 422
 * (NOT_ROUTABLE) when there is neither a resolved contact nor an override.
 */
export const RouteReportRequestSchema = z
  .object({
    id: z.string(),
    /** A one-off override of the jurisdiction's resolved contact for THIS send (else the resolved one). */
    contactEmailOverride: z.string().email().nullable().optional(),
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
 * Set a report's verification verdict (POST /admin/reports/:id/verdict). `id` consumes the path param
 * (mirrors RouteReportRequest / SetReportStatusRequest, which also carry the id the client reads to fill
 * `:id`); an `approved` verdict for a report whose reporter has >=2 approved reports earns them
 * report-verified (server-side recompute). Orthogonal to the civic report status. Returns a simple ok.
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
