import type {
  EventKind,
  FeedPageDTO,
  LinkedEventRef,
  PersonDTO,
  PostComposeInput,
  PostDTO,
  ReportCategory,
  ReportType,
} from "@civfix/shared"
import { appErrorCode } from "../data/errorCode"
import { mergeDateTime } from "./calendarModel"
import type { LinkedReportCardData } from "./linkedReportCards"

export interface FeedShareAuthUser {
  id: string
  displayName: string
  handle?: string | null
  avatarUrl?: string | null
}

export function personFromAuthUser(user: FeedShareAuthUser): PersonDTO {
  return {
    id: user.id,
    name: user.displayName,
    handle: user.handle ?? null,
    bio: null,
    avatar: null,
    avatarUrl: user.avatarUrl ?? null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

export const FEED_CAPTION_MAX = 280

export const FEED_CAPTION_COUNTER_AT = 240

export interface FeedShareValue {
  enabled: boolean
  caption: string
}

export type FeedShareTarget = { reportId: string } | { eventId: string }

export type FeedShareFailureReason = "network" | "rejected" | "rate-limited"

export type FeedShareOutcome =
  | { status: "skipped" }
  | { status: "posted"; postId: string }
  | {
      status: "failed"
      reason: FeedShareFailureReason
      retryable: boolean
      retry: FeedShareRetry
    }

export interface FeedShareRetry {
  target: FeedShareTarget
  caption: string
  report?: FeedShareReportSource | null
  event?: LinkedEventRef | null
}

export function buildFeedShareInput(
  share: FeedShareValue,
  target: FeedShareTarget,
): PostComposeInput | null {
  if (!share.enabled) return null
  const body = share.caption.trim().slice(0, FEED_CAPTION_MAX)
  return {
    kind: "post",
    ...(body.length > 0 ? { body } : {}),
    ...("reportId" in target ? { reportId: target.reportId } : { eventId: target.eventId }),
    mediaUploadIds: [],
    mentionedUserIds: [],
  }
}

export interface FeedShareReportDraft {
  category: string | null
  reportTypeId: string | null
  title: string
  addr: string | null
  media: ReadonlyArray<{ uri: string }>
}

export function buildReportPreviewCard(
  draft: FeedShareReportDraft,
  untitledLabel: string,
): LinkedReportCardData {
  return {
    id: "draft",
    category: (draft.category ?? "other") as ReportCategory,
    type: (draft.reportTypeId ?? null) as ReportType | null,
    title: draft.title.trim() || untitledLabel,
    status: "published",
    thumbUrl: draft.media[0]?.uri ?? null,
    addr: draft.addr,
  }
}

export interface FeedShareEventDraft {
  title: string
  eventKind: EventKind
  coords: { lat: number; lng: number } | null
  date: Date | null
  time: Date | null
}

export function buildEventPreviewCard(
  draft: FeedShareEventDraft,
  organizer: PersonDTO,
  now: string = new Date().toISOString(),
): LinkedEventRef | null {
  const title = draft.title.trim()
  if (!title || !draft.date || !draft.time) return null
  const scheduled = mergeDateTime(draft.date, draft.time)
  return {
    id: "draft",
    title,
    eventKind: draft.eventKind,
    status: "upcoming",
    scheduledAt: scheduled.toISOString(),
    lat: draft.coords?.lat ?? 0,
    lng: draft.coords?.lng ?? 0,
    going: 1,
    organizer,
    linkedAt: now,
  }
}

export interface FeedShareReportSource {
  id: string
  category: ReportCategory
  type?: ReportType | null
  title: string
  lat: number
  lng: number
  addr?: string | null
}

export interface OptimisticFeedSharePostArgs {
  author: PersonDTO
  caption: string
  report?: FeedShareReportSource | null
  event?: LinkedEventRef | null
  now?: string
}

export function buildOptimisticFeedSharePost(args: OptimisticFeedSharePostArgs): PostDTO {
  const now = args.now ?? new Date().toISOString()
  const body = args.caption.trim().slice(0, FEED_CAPTION_MAX)
  return {
    id: `optimistic-${Date.now()}`,
    author: args.author,
    kind: "post",
    body: body.length > 0 ? body : null,
    createdAt: now,
    editedAt: null,
    counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
    viewer: { liked: false, reposted: false, saved: false },
    media: [],
    mentions: [],
    repostOf: null,
    replyToId: null,
    threadRootId: null,
    event: args.event ?? null,
    report: args.report
      ? {
          id: args.report.id,
          category: args.report.category,
          ...(args.report.type ? { type: args.report.type } : {}),
          title: args.report.title.trim() || "Report",
          status: "published",
          lat: args.report.lat,
          lng: args.report.lng,
          addr: args.report.addr ?? null,
          thumbUrl: null,
          linkedAt: now,
        }
      : null,
  }
}

export function classifyFeedShareFailure(err: unknown): {
  reason: FeedShareFailureReason
  retryable: boolean
} {
  switch (appErrorCode(err)) {
    case "VALIDATION":
      return { reason: "rejected", retryable: false }
    case "RATE_LIMITED":
      return { reason: "rate-limited", retryable: true }
    default:
      return { reason: "network", retryable: true }
  }
}

export function findExistingFeedPost(
  page: Pick<FeedPageDTO, "items"> | null | undefined,
  target: FeedShareTarget,
  authorId: string,
): string | null {
  for (const item of page?.items ?? []) {
    if (!item || item.author?.id !== authorId) continue
    const hit =
      "reportId" in target ? item.report?.id === target.reportId : item.event?.id === target.eventId
    if (hit) return item.id
  }
  return null
}
