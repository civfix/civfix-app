import { z } from "zod"



export const IdSchema = z.string().uuid()
export type Id = z.infer<typeof IdSchema>

export const ReportRefOrIdSchema = z.string().min(1).max(64)
export type ReportRefOrId = z.infer<typeof ReportRefOrIdSchema>

export const CursorSchema = z.string()
export type Cursor = z.infer<typeof CursorSchema>

export const QueryBooleanSchema = z.union([
  z.boolean(),
  z.literal("true").transform(() => true),
  z.literal("false").transform(() => false),
  z.literal("1").transform(() => true),
  z.literal("0").transform(() => false),
])
export type QueryBoolean = z.infer<typeof QueryBooleanSchema>

export const PaginationQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

export function pageResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  })
}

export type PageResponse<T> = {
  items: T[]
  nextCursor: string | null
}

export const LatLngFields = {
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
} as const

export const LatLngSchema = z.object({ ...LatLngFields }).strict()
export type LatLng = z.infer<typeof LatLngSchema>

export const BBoxSchema = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .strict()
export type BBox = z.infer<typeof BBoxSchema>

export const ISODateSchema = z
  .preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? v : undefined),
    z.coerce.date(),
  )
  .transform((d) => d.toISOString())
export type ISODate = string

export type H3Cell = string

export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  fields: z.record(z.string()).optional(),
})
export type AppErrorShape = z.infer<typeof AppErrorSchema>


export const ReportCategorySchema = z.enum([
  "trash",
  "recycling",
  "graffiti",
  "hazard",
  "encampment",
  "water",
  "other",
])
export type ReportCategory = z.infer<typeof ReportCategorySchema>

export const ReportStatusSchema = z.enum([
  "submitted",
  "held",
  "published",
  "acknowledged",
  "in_progress",
  "resolved",
  "rejected",
])
export type ReportStatus = z.infer<typeof ReportStatusSchema>

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: "Submitted",
  held: "Under review",
  published: "Published",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  trash: "Trash",
  recycling: "Recycling",
  graffiti: "Graffiti",
  hazard: "Hazard",
  encampment: "Encampment",
  water: "Water",
  other: "Other",
}

export const ReportTypeSchema = z.enum([
  "dump",
  "encampment",
  "graffiti",
  "infrastructure",
  "pavement",
  "vegetation",
  "other",
])
export type ReportType = z.infer<typeof ReportTypeSchema>

export const REPORT_TYPE_VALUES = ReportTypeSchema.options

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  dump: "Dump",
  encampment: "Encampment",
  graffiti: "Graffiti",
  infrastructure: "Broken infrastructure",
  pavement: "Pavement distress",
  vegetation: "Overgrown vegetation",
  other: "Other",
}

export const REPORT_TYPE_TO_CATEGORY: Record<ReportType, ReportCategory> = {
  dump: "trash",
  encampment: "encampment",
  graffiti: "graffiti",
  infrastructure: "water",
  pavement: "hazard",
  vegetation: "recycling",
  other: "other",
}

export const REPORT_TYPE_CODE: Record<ReportType, string> = {
  dump: "DU",
  encampment: "EC",
  graffiti: "GR",
  infrastructure: "BI",
  pavement: "PD",
  vegetation: "OV",
  other: "OT",
}

export const GeomSourceSchema = z.enum(["device", "exif", "manual"])
export type GeomSource = z.infer<typeof GeomSourceSchema>

export const MediaKindSchema = z.enum(["image", "video"])
export type MediaKind = z.infer<typeof MediaKindSchema>

export const MediaStatusSchema = z.enum(["validating", "ready", "rejected", "held"])
export type MediaStatus = z.infer<typeof MediaStatusSchema>

export const MediaPurposeSchema = z.enum([
  "report",
  "post",
  "event_cover",
  "event_gallery",
  "org_logo",
])
export type MediaPurpose = z.infer<typeof MediaPurposeSchema>

export const PushPlatformSchema = z.enum(["ios", "android", "web"])
export type PushPlatform = z.infer<typeof PushPlatformSchema>

export const OAuthProviderSchema = z.enum(["apple", "google", "email"])
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>

export const CleanupMemberRoleSchema = z.enum([
  "organizer",
  "cohost",
  "member",
  "staff",
  "coordinator",
])
export type CleanupMemberRole = z.infer<typeof CleanupMemberRoleSchema>

export const AbuseSubjectTypeSchema = z.enum(["report", "media", "user", "anon_token"])
export type AbuseSubjectType = z.infer<typeof AbuseSubjectTypeSchema>

export const AbuseReasonSchema = z.enum(["nsfw", "phash_dup", "honeypot", "gps", "manual", "other"])
export type AbuseReason = z.infer<typeof AbuseReasonSchema>

export const AbuseSourceSchema = z.enum(["worker", "api", "user_report"])
export type AbuseSource = z.infer<typeof AbuseSourceSchema>

export const ContentReportSubjectSchema = z.enum([
  "report",
  "comment",
  "message",
  "event",
  "profile",
  "photo",
  "post",
])
export type ContentReportSubject = z.infer<typeof ContentReportSubjectSchema>

export const ContentReportReasonSchema = z.enum([
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "misinformation",
  "self_harm",
  "other",
])
export type ContentReportReason = z.infer<typeof ContentReportReasonSchema>

export const DELETED_USER_LABEL = "Deleted User"

export const MESSAGE_BODY_MAX = 2000

export const RoomKindSchema = z.enum(["cleanup", "dm", "report", "group"])
export type RoomKind = z.infer<typeof RoomKindSchema>

export const DiscoveryStatusSchema = z.enum(["open", "in_progress", "done"])
export type DiscoveryStatus = z.infer<typeof DiscoveryStatusSchema>


export const EventVisibilitySchema = z.enum(["public", "unlisted", "private"])
export type EventVisibility = z.infer<typeof EventVisibilitySchema>

export const OrganizationMemberRoleSchema = z.enum(["owner", "admin", "member"])
export type OrganizationMemberRole = z.infer<typeof OrganizationMemberRoleSchema>

export const OrgVerificationStatusSchema = z.enum(["unverified", "pending", "verified", "rejected"])
export type OrgVerificationStatus = z.infer<typeof OrgVerificationStatusSchema>

export const OrgVerificationKindSchema = z.enum(["nonprofit", "government", "community"])
export type OrgVerificationKind = z.infer<typeof OrgVerificationKindSchema>

export const TicketTypeVisibilitySchema = z.enum(["public", "hidden", "access_code"])
export type TicketTypeVisibility = z.infer<typeof TicketTypeVisibilitySchema>

export const MAX_PARTY_SIZE = 10

export const GUEST_MANAGE_TOKEN_MIN_LENGTH = 20
export const GUEST_MANAGE_TOKEN_MAX_LENGTH = 128

export const RegistrationStatusSchema = z.enum(["registered", "cancelled", "transferred"])
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>

export const RegistrationSourceSchema = z.enum(["self", "waitlist", "walkup", "transfer"])
export type RegistrationSource = z.infer<typeof RegistrationSourceSchema>

export const SeatStatusSchema = z.enum(["active", "cancelled"])
export type SeatStatus = z.infer<typeof SeatStatusSchema>

export const CheckinMethodSchema = z.enum(["scan", "manual", "self", "walkup"])
export type CheckinMethod = z.infer<typeof CheckinMethodSchema>

export const WaitlistStatusSchema = z.enum([
  "waiting",
  "offered",
  "claimed",
  "expired",
  "cancelled",
])
export type WaitlistStatus = z.infer<typeof WaitlistStatusSchema>

export const EventQuestionKindSchema = z.enum([
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "checkbox",
  "consent",
])
export type EventQuestionKind = z.infer<typeof EventQuestionKindSchema>

export const EventPageStatusSchema = z.enum(["draft", "published", "unpublished"])
export type EventPageStatus = z.infer<typeof EventPageStatusSchema>

export const EventPageBlockKindSchema = z.enum([
  "hero",
  "about",
  "agenda",
  "hosts",
  "faq",
  "location",
  "sponsors",
  "donate",
  "registration",
  "contact",
])
export type EventPageBlockKind = z.infer<typeof EventPageBlockKindSchema>

export const ThemeAccentSchema = z.enum(["bloom", "moss", "sun", "sky", "lilac"])
export type ThemeAccent = z.infer<typeof ThemeAccentSchema>

export const HostExportKindSchema = z.enum(["roster", "answers", "checkins"])
export type HostExportKind = z.infer<typeof HostExportKindSchema>

export const HostExportStatusSchema = z.enum([
  "queued",
  "running",
  "ready",
  "failed",
  "expired",
])
export type HostExportStatus = z.infer<typeof HostExportStatusSchema>

export const HostCapabilitySchema = z.enum([
  "view_event_private",
  "view_roster",
  "view_guest_contact",
  "view_answers",
  "view_analytics",
  "check_in",
  "manage_event",
  "manage_tickets",
  "manage_team",
  "broadcast",
  "export",
  "manage_page",
  "cancel_event",
  "manage_org_link",
  "moderate_chat",
  "request_resources",
  "manage_org_members",
])
export type HostCapability = z.infer<typeof HostCapabilitySchema>

export const HOST_CAPABILITY_VALUES = HostCapabilitySchema.options

export const BroadcastKindSchema = z.enum([
  "host_broadcast",
  "confirmation",
  "waitlist_promoted",
  "reminder",
  "event_updated",
  "event_cancelled",
  "thank_you",
  "announcement",
])
export type BroadcastKind = z.infer<typeof BroadcastKindSchema>

export const BroadcastStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
  "failed",
])
export type BroadcastStatus = z.infer<typeof BroadcastStatusSchema>

export const BroadcastChannelSchema = z.enum(["inapp", "push", "email", "sms"])
export type BroadcastChannel = z.infer<typeof BroadcastChannelSchema>

export const DeliveryStatusSchema = z.enum([
  "pending",
  "in_flight",
  "sent",
  "failed",
  "suppressed",
  "skipped",
])
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>

const BroadcastSegmentUnionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_registered") }).strict(),
  z
    .object({ kind: z.literal("ticket_types"), ids: z.array(IdSchema).min(1).max(20) })
    .strict(),
  z.object({ kind: z.literal("slots"), ids: z.array(IdSchema).min(1).max(20) }).strict(),
  z.object({ kind: z.literal("waitlist") }).strict(),
  z.object({ kind: z.literal("checked_in") }).strict(),
  z.object({ kind: z.literal("not_checked_in") }).strict(),
  z.object({ kind: z.literal("guests_only") }).strict(),
])
export type BroadcastSegment = z.infer<typeof BroadcastSegmentUnionSchema>

export const BroadcastSegmentSchema: z.ZodType<BroadcastSegment, z.ZodTypeDef, unknown> =
  BroadcastSegmentUnionSchema

export const PageViewSourceSchema = z.enum([
  "direct",
  "search",
  "social",
  "referral",
  "app",
  "other",
])
export type PageViewSource = z.infer<typeof PageViewSourceSchema>

export const LegalDocumentTypeSchema = z.enum(["terms", "privacy", "cookies", "subprocessors"])
export type LegalDocumentType = z.infer<typeof LegalDocumentTypeSchema>

export const ConsentSurfaceSchema = z.enum(["web_register", "mobile_register", "onboarding"])
export type ConsentSurface = z.infer<typeof ConsentSurfaceSchema>

export interface WebReportType {
  id: string
  label: string
  category: ReportCategory
}

export const WEB_REPORT_TYPES = [
  {
    id: "dump",
    label: "Illegal dumping",
    category: "trash",
  },
  {
    id: "encampment",
    label: "Encampment",
    category: "encampment",
  },
  {
    id: "graffiti",
    label: "Graffiti",
    category: "graffiti",
  },
  {
    id: "infrastructure",
    label: "Broken infrastructure",
    category: "water",
  },
  {
    id: "pavement",
    label: "Pavement distress",
    category: "hazard",
  },
  {
    id: "vegetation",
    label: "Overgrown vegetation",
    category: "recycling",
  },
  {
    id: "water",
    label: "Water/leak",
    category: "water",
  },
  {
    id: "recycling",
    label: "Recycling",
    category: "recycling",
  },
] as const satisfies readonly WebReportType[]

export type WebReportTypeId = (typeof WEB_REPORT_TYPES)[number]["id"]
