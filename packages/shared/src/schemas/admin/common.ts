import { z } from "zod"
import { CursorSchema } from "../common.js"

/**
 * Shared admin / operator DTOs, enums, and label maps.
 *
 * Every admin domain module (auth, home, discovery, reports, events, users, gov, moderation, mail,
 * analytics, ...) builds on the enums + the cursor-list query defined here. Reconciliation note: the
 * design prototype (legacy "PinIt") uses hyphenated status strings (in-progress) and a "cleanup"
 * report category; this contract uses the civfix model. See documents/phase2/00-architecture-decisions
 * section 8 and 01-design-enumeration section 4.
 *
 * The civfix report-status enum (submitted|held|published|acknowledged|in_progress|resolved|rejected)
 * and report-category enum (trash|recycling|graffiti|hazard|water|other) come from ../common.js and are
 * the canonical taxonomy the admin surfaces reuse directly.
 */

// ---------------------------------------------------------------------------
// Admin list query (cursor-paginated, with filter / sort / search)
// ---------------------------------------------------------------------------

/**
 * The generic admin list query: a free-text search, a named filter facet, a named sort key, plus
 * cursor pagination. Every admin list endpoint accepts a domain-narrowed version of this (each picks
 * its own `filter` / `sort` enums); this base captures the shared shape. Non-strict so a per-domain
 * extension can add fields (e.g. discovery's `geoid`) without re-declaring the common ones, and so a
 * GET query that echoes an extra param still parses. `limit` is coerced because GET query values
 * arrive as strings.
 */
export const AdminListQuerySchema = z.object({
  q: z.string().optional(),
  filter: z.string().optional(),
  sort: z.string().optional(),
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})
export type AdminListQuery = z.infer<typeof AdminListQuerySchema>

// ---------------------------------------------------------------------------
// Relative + absolute timestamp pair
// ---------------------------------------------------------------------------

/**
 * The design renders most timestamps as a relative string ("3h ago", "in 2 days") next to an absolute
 * one ("Jun 3, 2026, 4:12 PM"). The server computes both so clients render identically without a
 * date library. `rel` is the short relative label; `abs` the long absolute label.
 */
export const RelAbsTimeSchema = z
  .object({
    rel: z.string(),
    abs: z.string(),
  })
  .strict()
export type RelAbsTime = z.infer<typeof RelAbsTimeSchema>

/** A flat [lat, lng] map coordinate as the design's markers carry them (`coords: [lat, lng]`). */
export const AdminCoordsSchema = z.tuple([z.number(), z.number()])
export type AdminCoords = z.infer<typeof AdminCoordsSchema>

// ---------------------------------------------------------------------------
// Admin enums (status / risk / moderation / verification facets)
// ---------------------------------------------------------------------------

/**
 * The status the operator sees on a report row. This is the civfix report-status enum verbatim (NOT
 * the design's submitted|in-progress|completed): the design buckets map to submitted / in_progress /
 * resolved, with held|published as moderation states and rejected as "removed". Reused from the
 * canonical ReportStatusSchema so the admin surface and the citizen surface never diverge.
 */
export { ReportStatusSchema as AdminReportStatusSchema } from "../common.js"
export type { ReportStatus as AdminReportStatus } from "../common.js"

/** Operator-facing labels for the civfix report statuses (design showed Submitted/In progress/...). */
export const ADMIN_REPORT_STATUS_LABELS = {
  submitted: "Submitted",
  held: "Under review",
  published: "Published",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Removed",
} as const

/**
 * Cleanup (event) lifecycle. Design EVENT_STATUS = upcoming|in-progress|completed; civfix adds
 * `cancelled` ("Cancel event" -> cancelled) and uses the underscore form `in_progress`.
 */
export const EventStatusSchema = z.enum(["upcoming", "in_progress", "completed", "cancelled"])
export type EventStatus = z.infer<typeof EventStatusSchema>

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

/**
 * Cleanup discovery-task review state surfaced in the discovery queue (open work vs in-progress vs
 * done). Mirrors the Phase 1 DiscoveryStatus but is named distinctly here for the admin label map (the
 * Phase 1 CleanupStatusSchema in entities.ts is the cleanup-event lifecycle, a different enum).
 */
export const DiscoveryReviewStatusSchema = z.enum(["open", "in_progress", "done"])
export type DiscoveryReviewStatus = z.infer<typeof DiscoveryReviewStatusSchema>

export const DISCOVERY_REVIEW_STATUS_LABELS: Record<DiscoveryReviewStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
}

/**
 * Mail thread / delivery status. Design MAIL_STATUS = sent|delivered|opened|replied|auto|
 * needs-action|bounced; the underscore form `needs_action` is used in the model. "opened" depends on
 * open-tracking (optional for a non-profit; kept for completeness).
 */
export const MailStatusSchema = z.enum([
  "sent",
  "delivered",
  "opened",
  "replied",
  "auto",
  "needs_action",
  "bounced",
])
export type MailStatus = z.infer<typeof MailStatusSchema>

export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  replied: "Replied",
  auto: "Auto-reply",
  needs_action: "Needs action",
  bounced: "Bounced",
}

/** Direction of a mail thread / message (inbound reply vs outbound outreach). */
export const MailDirectionSchema = z.enum(["in", "out"])
export type MailDirection = z.infer<typeof MailDirectionSchema>

/** Account status driving suspend / ban (design USER_STATUS = active|suspended|review, plus banned). */
export const UserStatusSchema = z.enum(["active", "suspended", "review", "banned"])
export type UserStatus = z.infer<typeof UserStatusSchema>

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  review: "In review",
  banned: "Banned",
}

/** A user's moderation risk band (design risk = low|watch|elevated|high). */
export const RiskSchema = z.enum(["low", "watch", "elevated", "high"])
export type Risk = z.infer<typeof RiskSchema>

export const RISK_LABELS: Record<Risk, string> = {
  low: "Low",
  watch: "Watch",
  elevated: "Elevated",
  high: "High",
}

/**
 * What a moderation queue item is about (design kind = image|pattern|appeal|gps|duplicate). image is
 * a held photo, pattern a coordinated-reports cluster, appeal a user appeal, gps a spoof check,
 * duplicate a near-duplicate. `user_report` is a citizen-filed content report (the user-facing "Report"
 * button -> ContentReportSubject/Reason -> the moderation queue). Backend mirrors this exact value list.
 */
export const ModerationKindSchema = z.enum([
  "image",
  "pattern",
  "appeal",
  "gps",
  "duplicate",
  "user_report",
])
export type ModerationKind = z.infer<typeof ModerationKindSchema>

export const MODERATION_KIND_LABELS: Record<ModerationKind, string> = {
  image: "Image",
  pattern: "Pattern",
  appeal: "Appeal",
  gps: "GPS",
  duplicate: "Duplicate",
  user_report: "User report",
}

/**
 * What KIND of subject a moderation item (especially a citizen `user_report`) points at - the admin-side
 * mirror of the user-facing ContentReportSubject, plus the legacy report/user/chat subjects the queue
 * already carried. Backend mirrors this exact value list (types.ts + enums.test.ts) - keep them identical.
 */
export const ModerationSubjectTypeSchema = z.enum([
  "report",
  "user",
  "chat",
  "comment",
  "message",
  "event",
  "profile",
  "photo",
  "post",
])
export type ModerationSubjectType = z.infer<typeof ModerationSubjectTypeSchema>

/** Admin detail pages a moderation subject can explicitly resolve to. */
export const ModerationDestinationKindSchema = z.enum(["report", "event", "user"])
export type ModerationDestinationKind = z.infer<typeof ModerationDestinationKindSchema>

/** The tone of a single moderation signal cell (design signals[*].tone = ok|warn|bad). */
export const ModerationToneSchema = z.enum(["ok", "warn", "bad"])
export type ModerationTone = z.infer<typeof ModerationToneSchema>

/** Queue priority bands shared by moderation + discovery rows (design priority = low|med|high). */
export const PrioritySchema = z.enum(["low", "med", "high"])
export type Priority = z.infer<typeof PrioritySchema>

/** The three gov-claim verification checks the operator completes (design verified[]/pending[]). */
export const GovVerificationCheckSchema = z.enum(["linkedin", "directory", "callback"])
export type GovVerificationCheck = z.infer<typeof GovVerificationCheckSchema>

export const GOV_VERIFICATION_CHECK_LABELS: Record<GovVerificationCheck, string> = {
  linkedin: "LinkedIn",
  directory: "Directory",
  callback: "Callback",
}

/** Per-check verification state (design checks.{check}.status = verified|pending). */
export const GovCheckStatusSchema = z.enum(["verified", "pending"])
export type GovCheckStatus = z.infer<typeof GovCheckStatusSchema>

/** How a gov applicant reached us (design method = email|cold-outreach -> cold_outreach). */
export const GovMethodSchema = z.enum(["email", "cold_outreach"])
export type GovMethod = z.infer<typeof GovMethodSchema>

/** Lifecycle of a gov provisioning claim (design implies pending -> approved|rejected). */
export const GovClaimStatusSchema = z.enum(["pending", "approved", "rejected"])
export type GovClaimStatus = z.infer<typeof GovClaimStatusSchema>

// ---------------------------------------------------------------------------
// Small shared admin DTO fragments
// ---------------------------------------------------------------------------

/**
 * A compact actor reference (reporter / organizer / user) shown on report + event detail panels:
 * id, display name, handle, and the join date. Shared so the reports + events detail DTOs define it once.
 */
export const AdminActorRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    handle: z.string(),
    joined: z.string(),
  })
  .strict()
export type AdminActorRef = z.infer<typeof AdminActorRefSchema>

/** A simple ok-acknowledgement for admin mutations that return no resource body. */
export const AdminOkResponseSchema = z.object({ ok: z.literal(true) }).strict()
export type AdminOkResponse = z.infer<typeof AdminOkResponseSchema>
