import type { AnnouncementAudience, AnnouncementDTO } from "@civfix/shared"
import {
  ANNOUNCEMENT_AUDIENCE_KINDS,
  ErrorCode,
  MAX_ANNOUNCEMENT_BODY,
  byErrorCode,
  type ErrorCodeTable,
} from "@civfix/shared"
import type { IconName } from "../../typography/icon-map"

export const ANNOUNCEMENT_PREVIEW_LINES = 2

export const EVENT_DETAIL_ANNOUNCEMENTS = 2

export const HOST_HISTORY_ANNOUNCEMENTS = 3

export const ANNOUNCEMENT_PREVIEW_CHARS = 180

const ANNOUNCEMENT_BODY_COUNTER_AT = 0.9

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

export interface AnnouncementByline {
  name: string
  seed: string
  photoUrl: string | null
  gradient: readonly [string, string] | null
}

export function announcementByline(
  announcement: AnnouncementDTO,
  hostLabel: string,
): AnnouncementByline {
  const org = announcement.authorOrg ?? null
  const author = announcement.author ?? null
  return {
    name: org?.name ?? author?.name ?? hostLabel,
    seed: org?.id ?? author?.id ?? announcement.id,
    photoUrl: org?.logoUrl ?? author?.avatarUrl ?? null,
    gradient: org ? null : (author?.avatar ?? null),
  }
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

export function seeAllTotal(loaded: number, hasMore: boolean): number | null {
  return hasMore ? null : loaded
}

export function announcementSentAt(announcement: AnnouncementDTO): string {
  return announcement.sentAt ?? announcement.createdAt
}

const ANNOUNCEMENT_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.RATE_LIMITED]: "announce.error_rate_limited",
  [ErrorCode.FORBIDDEN]: "announce.error_forbidden",
  [ErrorCode.CONFLICT]: "announce.error_conflict",
  [ErrorCode.VALIDATION]: "announce.error_validation",
  [ErrorCode.ABUSE_HELD]: "announce.error_held",
}

export function announcementErrorKey(code: string | undefined): string {
  return byErrorCode(code, ANNOUNCEMENT_ERROR_KEYS, "announce.error_generic")
}
