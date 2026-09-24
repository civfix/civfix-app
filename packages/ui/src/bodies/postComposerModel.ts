import type { TFunction } from "i18next"
import type {
  CleanupDTO,
  LinkedEventRef,
  LinkedReportRef,
  PostDTO,
  PostRefDTO,
  ReportDTO,
  UserMentionDTO,
} from "@civfix/shared"
import type { MentionCandidate } from "../primitives/MentionAutocomplete"
import { splitPostBodyMentions } from "./postCardModel"
import type { PostComposerMode } from "./postComposerStore"

export type PostComposerAttachmentPanel = "events" | "reports" | null

/** Mirrors `PostComposeInputSchema.body`'s cap, which the contract states as a bare literal. */
export const POST_BODY_MAX_LENGTH = 2000

export interface PostComposerModel {
  title: string
  submitLabel: string
  placeholder: string
}

export function buildPostComposerModel(mode: PostComposerMode, t: TFunction): PostComposerModel {
  if (mode === "reply") {
    return {
      title: t("mode.reply.title"),
      submitLabel: t("action.reply"),
      placeholder: t("mode.reply.placeholder"),
    }
  }
  if (mode === "quote") {
    return {
      title: t("mode.quote.title"),
      submitLabel: t("action.post"),
      placeholder: t("mode.quote.placeholder"),
    }
  }
  return {
    title: t("mode.post.title"),
    submitLabel: t("action.post"),
    placeholder: t("mode.post.placeholder"),
  }
}

export function activePostMentions(
  body: string,
  mentions: readonly UserMentionDTO[],
): UserMentionDTO[] {
  if (mentions.length === 0) return []
  const present = new Set(
    splitPostBodyMentions(body, mentions).flatMap((segment) =>
      segment.kind === "mention" ? [segment.userId] : [],
    ),
  )
  return mentions.filter((mention) => present.has(mention.id))
}

/**
 * The draft's mention list after picking `candidate`, or null when there is nothing to record: a
 * jurisdiction handle stays plain body text. A re-picked user moves to the end with its fresh names.
 */
export function mergeMention(
  mentioned: readonly UserMentionDTO[],
  candidate: MentionCandidate,
): UserMentionDTO[] | null {
  if (candidate.kind === "jurisdiction") return null
  const user: UserMentionDTO = { id: candidate.id, handle: candidate.handle, displayName: candidate.displayName }
  return [...mentioned.filter((item) => item.id !== user.id), user]
}

export function togglePostComposerAttachmentPanel(
  current: PostComposerAttachmentPanel,
  requested: Exclude<PostComposerAttachmentPanel, null>,
): PostComposerAttachmentPanel {
  return current === requested ? null : requested
}

export const POST_COMPOSER_ATTACH_CANDIDATE_CAP = 2

export type PostComposerAttachVariant = "sections" | "pills" | "hidden"

export type PostComposerAttachGroupState = "attached" | "list" | "empty" | "loading"

export function postComposerSectionVisible(state: PostComposerAttachGroupState): boolean {
  return state === "attached" || state === "list"
}

export interface PostComposerAttachGroupPlan {
  state: PostComposerAttachGroupState
  visibleCount: number
  showMoreVisible: boolean
  showMoreCount: number | null
  showFewerVisible: boolean
}

export interface PostComposerAttachPlan {
  variant: PostComposerAttachVariant
  events: PostComposerAttachGroupPlan
  reports: PostComposerAttachGroupPlan
  eventPanelVisible: boolean
  reportPanelVisible: boolean
}

interface AttachGroupInput {
  loaded: boolean
  count: number
  expanded: boolean
  hasNextPage?: boolean
  attached: boolean
}

function buildGroupPlan(input: AttachGroupInput, variant: PostComposerAttachVariant): PostComposerAttachGroupPlan {
  const none = { visibleCount: 0, showMoreVisible: false, showMoreCount: null, showFewerVisible: false }
  if (input.attached && variant !== "pills") return { state: "attached", ...none }
  if (!input.loaded) return { state: "loading", ...none }
  if (input.count === 0) return { state: "empty", ...none }

  const visibleCount = variant === "pills" || input.expanded
    ? input.count
    : Math.min(input.count, POST_COMPOSER_ATTACH_CANDIDATE_CAP)
  const hasNextPage = input.hasNextPage === true
  const hiddenCount = input.count - visibleCount
  return {
    state: "list",
    visibleCount,
    showMoreVisible: hiddenCount > 0 || hasNextPage,
    showMoreCount: hiddenCount > 0 && !hasNextPage ? hiddenCount : null,
    showFewerVisible: variant === "sections" && input.expanded && input.count > POST_COMPOSER_ATTACH_CANDIDATE_CAP,
  }
}

export function buildPostComposerAttachPlan(args: {
  mode: PostComposerMode
  signedIn: boolean
  attachmentPanel: PostComposerAttachmentPanel
  events: Omit<AttachGroupInput, "hasNextPage">
  reports: AttachGroupInput
}): PostComposerAttachPlan {
  if (!args.signedIn) {
    const hidden: PostComposerAttachGroupPlan = {
      state: "empty",
      visibleCount: 0,
      showMoreVisible: false,
      showMoreCount: null,
      showFewerVisible: false,
    }
    return { variant: "hidden", events: hidden, reports: hidden, eventPanelVisible: false, reportPanelVisible: false }
  }
  const variant: PostComposerAttachVariant = args.mode === "reply" ? "pills" : "sections"
  return {
    variant,
    events: buildGroupPlan(args.events, variant),
    reports: buildGroupPlan(args.reports, variant),
    eventPanelVisible: variant === "pills" && args.attachmentPanel === "events",
    reportPanelVisible: variant === "pills" && args.attachmentPanel === "reports",
  }
}

export function shouldClearStaleAttachedEvent(args: {
  attachedEventId: string | null
  resolved: boolean
  loaded: boolean
}): boolean {
  return args.attachedEventId != null && !args.resolved && args.loaded
}

export function shouldClearStaleAttachedReport(args: {
  attachedReportId: string | null
  resolved: boolean
  loaded: boolean
  hasNextPage: boolean
  hasSnapshot?: boolean
}): boolean {
  if (args.hasSnapshot) return false
  return args.attachedReportId != null && !args.resolved && args.loaded && !args.hasNextPage
}

export function buildComposerQuoteRef(post: PostDTO): PostRefDTO {
  return {
    id: post.id,
    author: post.author,
    organization: post.organization ?? null,
    kind: post.kind,
    excerpt: post.body ?? "",
    createdAt: post.createdAt,
    media: post.media ?? [],
    body: post.body ?? null,
    event: post.event ?? null,
    report: post.report ?? null,
  }
}

export function buildComposerEventRef(event: CleanupDTO, linkedAt = event.scheduledAt): LinkedEventRef {
  return {
    id: event.id,
    title: event.title,
    eventKind: event.eventKind,
    status: event.status,
    scheduledAt: event.scheduledAt,
    endsAt: event.endsAt ?? null,
    timezone: event.timezone ?? null,
    lat: event.lat,
    lng: event.lng,
    going: event.going,
    organizer: event.organizer,
    linkedAt,
  }
}

export function resolveComposerEvent(
  attachedEventId: string | null,
  attachedEvent: LinkedEventRef | null,
  availableEvents: readonly CleanupDTO[],
): LinkedEventRef | null {
  if (!attachedEventId) return null
  if (attachedEvent?.id === attachedEventId) return attachedEvent

  const availableEvent = availableEvents.find((event) => event.id === attachedEventId)
  return availableEvent ? buildComposerEventRef(availableEvent) : null
}

export function buildComposerReportRef(
  report: Pick<ReportDTO, "id" | "category" | "type" | "status" | "lat" | "lng" | "addr" | "title" | "description" | "media">,
  linkedAt = new Date().toISOString(),
): LinkedReportRef {
  return {
    id: report.id,
    category: report.category,
    type: report.type,
    title: report.title ?? report.description ?? "Report",
    status: report.status,
    lat: report.lat,
    lng: report.lng,
    addr: report.addr,
    thumbUrl: report.media?.[0]?.thumbUrl ?? report.media?.[0]?.url ?? null,
    linkedAt,
  }
}

export function resolveComposerReport(
  attachedReportId: string | null,
  attachedReport: LinkedReportRef | null,
  availableReports: readonly ReportDTO[],
): LinkedReportRef | null {
  if (!attachedReportId) return null
  if (attachedReport?.id === attachedReportId) return attachedReport

  const available = availableReports.find((report) => report.id === attachedReportId)
  return available ? buildComposerReportRef(available) : null
}
