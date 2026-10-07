/**
 * One draft -> decision for the Post button, shared by the press handler and its `disabled` prop.
 * `PostComposeInputSchema` requires some content, and media must finalize before submit because the caller
 * can only stamp finalized `mediaUploadIds` into the input.
 */
import type {
  LinkedEventRef,
  LinkedReportRef,
  OrganizationDTO,
  OrganizationRefDTO,
  PersonDTO,
  PostComposeInput,
  PostDTO,
  PostKind,
  UserMentionDTO,
} from "@civfix/shared"
import type { PostComposerMedia } from "./postComposerStore"
import { optimisticPostId } from "./thread/threadModel"

export type PostSubmitDestination = "origin" | "thread"

/**
 * `PostComposeInputSchema` caps `mentionedUserIds` at 20. A body naming more still publishes; the handles
 * past the cap stay plain text instead of the whole post failing with the generic submit error.
 */
export const POST_MENTION_CAP = 20

/** Mirrors the server's own projection (`r.title ?? "Report"`), so an optimistic card never snaps. */
export const REPORT_TITLE_FALLBACK = "Report"

export function postSubmitDestination(kind: PostKind): PostSubmitDestination {
  return kind === "post" ? "origin" : "thread"
}

export interface PostDraft {
  body: string
  /** The server refuses an event the author neither hosts nor attends. */
  eventId?: string | null
  reportId?: string | null
  /** Staged items, including ones still uploading. */
  mediaCount?: number
  mediaUploadIds?: string[]
  kind?: PostKind
  replyToId?: string | null
  repostOfId?: string | null
  mentionedUserIds?: string[]
  organizationId?: string | null
}

export type PostSubmitResolution =
  | { action: "submit"; input: PostComposeInput }
  | { action: "blocked-empty" }
  | { action: "blocked-media-pending" }

/** Both `blocked-*` actions mean a disabled Post button. */
export function resolvePostSubmit(draft: PostDraft, hasReadyMedia = false): PostSubmitResolution {
  const body = draft.body.trim()
  const hasBody = body.length > 0
  const hasAttachment = Boolean(draft.eventId) || Boolean(draft.reportId)
  const wantsMedia = (draft.mediaCount ?? 0) > 0

  if (!hasBody && !hasAttachment && !wantsMedia) return { action: "blocked-empty" }
  if (wantsMedia && !hasReadyMedia) return { action: "blocked-media-pending" }

  const input: PostComposeInput = {
    kind: draft.kind ?? "post",
    ...(hasBody ? { body } : {}),
    ...(draft.replyToId ? { replyToId: draft.replyToId } : {}),
    ...(draft.repostOfId ? { repostOfId: draft.repostOfId } : {}),
    ...(draft.eventId ? { eventId: draft.eventId } : {}),
    ...(draft.reportId ? { reportId: draft.reportId } : {}),
    mediaUploadIds: draft.mediaUploadIds ?? [],
    mentionedUserIds: [...new Set(draft.mentionedUserIds ?? [])].slice(0, POST_MENTION_CAP),
    ...(draft.organizationId && draft.kind !== "repost"
      ? { organizationId: draft.organizationId }
      : {}),
  }
  return { action: "submit", input }
}

export function toPostOrganizationRef(org: OrganizationDTO): OrganizationRefDTO {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    logoUrl: org.logoUrl ?? null,
    verified: org.verifiedStatus === "verified",
    ...(org.verifiedKind ? { verifiedKind: org.verifiedKind } : {}),
  }
}

export interface OptimisticPostArgs {
  author: PersonDTO
  kind: PostKind
  body: string | null
  now: Date
  /** Left off the DTO when undefined: only the surfaces that can post as an organization set the key. */
  organization?: OrganizationRefDTO | null
  /** Only items with a finalized `uploadId` render; the rest are still uploading. */
  media?: readonly PostComposerMedia[]
  mentions?: UserMentionDTO[]
  event?: LinkedEventRef | null
  report?: LinkedReportRef | null
  replyToId?: string | null
  threadRootId?: string | null
}

/** The zero-count placeholder a composer writes into the feed and thread caches until the server's post lands. */
export function buildOptimisticPost(args: OptimisticPostArgs): PostDTO {
  return {
    id: optimisticPostId(args.now.getTime()),
    author: args.author,
    ...(args.organization !== undefined ? { organization: args.organization } : {}),
    kind: args.kind,
    body: args.body,
    createdAt: args.now.toISOString(),
    editedAt: null,
    counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
    viewer: { liked: false, reposted: false, saved: false },
    media: (args.media ?? []).flatMap((item) =>
      item.uploadId
        ? [{ id: item.uploadId, kind: item.kind, url: item.uri, thumbUrl: item.posterUri, status: "ready" as const }]
        : [],
    ),
    mentions: args.mentions ?? [],
    event: args.event ?? null,
    report: args.report ?? null,
    repostOf: null,
    replyToId: args.replyToId ?? null,
    threadRootId: args.threadRootId ?? null,
  }
}
