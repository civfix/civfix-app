import type { AnnouncementAudience, AnnouncementDTO } from "@civfix/shared"
import { ANNOUNCEMENT_AUDIENCE_KINDS, MAX_ANNOUNCEMENT_BODY } from "@civfix/shared"
import type { IconName } from "../../typography/icon-map"

export const ANNOUNCEMENT_PREVIEW_LINES = 2

export const EVENT_DETAIL_ANNOUNCEMENTS = 2

export const HOST_HISTORY_ANNOUNCEMENTS = 3

export const ANNOUNCEMENT_PREVIEW_CHARS = 180

export const ANNOUNCEMENT_BODY_COUNTER_AT = 0.9

export const AUDIENCE_OPTIONS = ANNOUNCEMENT_AUDIENCE_KINDS

export type AnnouncementAudienceKindOption = (typeof AUDIENCE_OPTIONS)[number]

export const AUDIENCE_ICONS: Readonly<Record<AnnouncementAudienceKindOption, IconName>> = {
  all_registered: "Users",
  checked_in: "CheckCheck",
  not_checked_in: "Clock",
  waitlist: "Hourglass",
  slots: "CalendarCheck",
}

export function audienceFor(
  kind: AnnouncementAudienceKindOption,
  slotIds: readonly string[],
): AnnouncementAudience {
  if (kind === "slots") return { kind, ids: [...slotIds] }
  return { kind }
}

export function audienceReady(
  kind: AnnouncementAudienceKindOption,
  slotIds: readonly string[],
): boolean {
  return kind !== "slots" || slotIds.length > 0
}

export function announcementReady(body: string): boolean {
  const trimmed = body.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_ANNOUNCEMENT_BODY
}

export function bodyCounterVisible(length: number): boolean {
  return length >= Math.floor(MAX_ANNOUNCEMENT_BODY * ANNOUNCEMENT_BODY_COUNTER_AT)
}

const MARKDOWN_MARKS = /^[\s>#*\-+]+|[*_`]/g

export function announcementPreview(bodyMd: string): string {
  const flattened = bodyMd
    .split("\n")
    .map((line) => line.replace(MARKDOWN_MARKS, "").trim())
    .filter((line) => line.length > 0)
    .join(" ")
  return flattened.length > ANNOUNCEMENT_PREVIEW_CHARS
    ? `${flattened.slice(0, ANNOUNCEMENT_PREVIEW_CHARS).trimEnd()}…`
    : flattened
}

export function announcementHeading(announcement: AnnouncementDTO): string | null {
  const title = announcement.title?.trim()
  return title && title.length > 0 ? title : null
}

export function announcementCounts(announcement: AnnouncementDTO): {
  recipients: number
  sent: number
  failed: number
} | null {
  if (announcement.recipientCount === undefined) return null
  return {
    recipients: announcement.recipientCount,
    sent: announcement.sentCount ?? 0,
    failed: announcement.failedCount ?? 0,
  }
}

export function announcementSentAt(announcement: AnnouncementDTO): string {
  return announcement.sentAt ?? announcement.createdAt
}

export function announcementErrorKey(code: string | undefined): string {
  if (code === "RATE_LIMITED") return "announce.error_rate_limited"
  if (code === "FORBIDDEN") return "announce.error_forbidden"
  if (code === "CONFLICT") return "announce.error_conflict"
  if (code === "VALIDATION") return "announce.error_validation"
  if (code === "ABUSE_HELD") return "announce.error_held"
  return "announce.error_generic"
}
