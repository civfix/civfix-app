import { z } from "zod"
import { CursorSchema } from "../common.js"

/**
 * Shared admin / operator enums, label maps and DTO fragments. The admin surfaces reuse the canonical
 * report-status and report-category enums from ../common.js directly, so the operator and citizen views
 * never diverge.
 */

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

/**
 * A relative label ("3h ago", "in 2 days") paired with an absolute one ("Jun 3, 2026, 4:12 PM"). The
 * server computes both so clients render identically without a date library.
 */
export const RelAbsTimeSchema = z
  .object({
    rel: z.string(),
    abs: z.string(),
  })
  .strict()
export type RelAbsTime = z.infer<typeof RelAbsTimeSchema>

/** A flat `[lat, lng]` map coordinate (latitude first). */
export const AdminCoordsSchema = z.tuple([z.number(), z.number()])
export type AdminCoords = z.infer<typeof AdminCoordsSchema>

/**
 * The status the operator sees on a report row: the canonical `ReportStatusSchema` verbatim, so the
 * admin and citizen surfaces never diverge. held|published are moderation states and rejected reads as
 * "Removed".
 */
export { ReportStatusSchema as AdminReportStatusSchema } from "../common.js"
export type { ReportStatus as AdminReportStatus } from "../common.js"
import type { ReportStatus as AdminReportStatus } from "../common.js"

/** Operator-facing labels for the civfix report statuses. */
export const ADMIN_REPORT_STATUS_LABELS = {
  submitted: "Submitted",
  held: "Under review",
  published: "Published",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Removed",
} as const

export const ADMIN_REPORT_STATUS_TRANSITIONS: Record<AdminReportStatus, readonly AdminReportStatus[]> = {
  submitted: ["held", "published"],
  held: ["published"],
  published: ["acknowledged", "in_progress", "held"],
  acknowledged: ["in_progress", "resolved", "published"],
  in_progress: ["resolved", "acknowledged"],
  resolved: ["in_progress"],
  rejected: [],
}

export function canTransitionReportStatus(from: AdminReportStatus, to: AdminReportStatus): boolean {
  return ADMIN_REPORT_STATUS_TRANSITIONS[from].includes(to)
}

/** Cleanup (event) lifecycle. */
export const EventStatusSchema = z.enum(["upcoming", "in_progress", "completed", "cancelled"])
export type EventStatus = z.infer<typeof EventStatusSchema>

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

/**
 * Discovery-task review state in the discovery queue. Named distinctly from `CleanupStatusSchema` in
 * entities.ts, which is the cleanup-event lifecycle, a different enum.
 */
export const DiscoveryReviewStatusSchema = z.enum(["open", "in_progress", "done"])
export type DiscoveryReviewStatus = z.infer<typeof DiscoveryReviewStatusSchema>

export const DISCOVERY_REVIEW_STATUS_LABELS: Record<DiscoveryReviewStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
}

/** Mail thread / delivery status. "opened" only appears when open-tracking is on. */
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

export const MailAuthVerdictSchema = z.enum(["pass", "fail", "unknown"])
export type MailAuthVerdict = z.infer<typeof MailAuthVerdictSchema>

export const MAIL_AUTH_VERDICT_LABELS: Record<MailAuthVerdict, string> = {
  pass: "Verified sender",
  fail: "Failed sender check",
  unknown: "Sender not checked",
}

export const MailReplyPublicationSchema = z.enum(["withheld", "pending", "published"])
export type MailReplyPublication = z.infer<typeof MailReplyPublicationSchema>

export const MAIL_REPLY_PUBLICATION_LABELS: Record<MailReplyPublication, string> = {
  withheld: "Withheld",
  pending: "Publishing",
  published: "Published",
}

/** Account status driving suspend / ban. */
export const UserStatusSchema = z.enum(["active", "suspended", "review", "banned"])
export type UserStatus = z.infer<typeof UserStatusSchema>

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  review: "In review",
  banned: "Banned",
}

/** A user's moderation risk band. */
export const RiskSchema = z.enum(["low", "watch", "elevated", "high"])
export type Risk = z.infer<typeof RiskSchema>

export const RISK_LABELS: Record<Risk, string> = {
  low: "Low",
  watch: "Watch",
  elevated: "Elevated",
  high: "High",
}

/**
 * What a moderation queue item is about: image is a held photo, pattern a coordinated-reports cluster,
 * appeal a user appeal, gps a spoof check, duplicate a near-duplicate, and `user_report` a citizen-filed
 * content report. The backend mirrors this exact value list.
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
 * What KIND of subject a moderation item (especially a citizen `user_report`) points at: the user-facing
 * ContentReportSubject plus the report/user/chat subjects. The backend mirrors this exact value list
 * (types.ts + enums.test.ts); keep them identical.
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

/** The tone of a single moderation signal cell. */
export const ModerationToneSchema = z.enum(["ok", "warn", "bad"])
export type ModerationTone = z.infer<typeof ModerationToneSchema>

/** Queue priority bands shared by moderation + discovery rows. */
export const PrioritySchema = z.enum(["low", "med", "high"])
export type Priority = z.infer<typeof PrioritySchema>

/** The three gov-claim verification checks the operator completes. */
export const GovVerificationCheckSchema = z.enum(["linkedin", "directory", "callback"])
export type GovVerificationCheck = z.infer<typeof GovVerificationCheckSchema>

export const GOV_VERIFICATION_CHECK_LABELS: Record<GovVerificationCheck, string> = {
  linkedin: "LinkedIn",
  directory: "Directory",
  callback: "Callback",
}

/** Per-check verification state. */
export const GovCheckStatusSchema = z.enum(["verified", "pending"])
export type GovCheckStatus = z.infer<typeof GovCheckStatusSchema>

/** How a gov applicant reached us. */
export const GovMethodSchema = z.enum(["email", "cold_outreach"])
export type GovMethod = z.infer<typeof GovMethodSchema>

/** Lifecycle of a gov provisioning claim: pending, then approved or rejected. */
export const GovClaimStatusSchema = z.enum(["pending", "approved", "rejected"])
export type GovClaimStatus = z.infer<typeof GovClaimStatusSchema>

/** A compact actor reference (reporter / organizer / user) on report and event detail panels. */
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
