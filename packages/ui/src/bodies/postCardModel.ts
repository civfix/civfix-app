import type { TFunction } from "i18next"
import type { PostDTO, PostRefDTO, UserMentionDTO } from "@civfix/shared"
import { listTimeAgo } from "./relativeTime"

export type PostCardVariant = "post" | "event" | "repost" | "quote" | "reply" | "fix-confirmed"
export type PostFixLayout = "before-after" | "cleared" | null

export interface PostCardModelOptions {
  neighborhood?: string | null
  reportedBy?: string | null
  resolutionLabel?: string | null
  timeAgo?: (iso: string) => string
}

export interface PostCardModel {
  variant: PostCardVariant
  showOrganizerBadge: boolean
  metaLabel: string
  repostAttribution: string | null
  embeddedPost: PostRefDTO | null
  fixLayout: PostFixLayout
  categoryLabel: string | null
  reportedByLabel: string | null
  resolutionLabel: string | null
  handleLabel: string | null
  timeLabel: string
  contextLabel: string | null
  bodyExpandable: boolean
  showFixShowcase: boolean
  replyingToLabel: string | null
}

export const POST_BODY_CLAMP_LINES = 10

const BODY_CLAMP_CHARS = 340

export type PostBodySegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; userId: string; handle: string }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function splitPostBodyMentions(
  body: string,
  mentions: readonly UserMentionDTO[] | undefined,
): PostBodySegment[] {
  if (!body) return []
  const byHandle = new Map<string, UserMentionDTO>()
  for (const mention of mentions ?? []) {
    const handle = mention.handle.replace(/^@/, "").trim()
    if (handle) byHandle.set(handle.toLocaleLowerCase(), mention)
  }
  if (byHandle.size === 0) return [{ kind: "text", text: body }]
  const alternatives = [...byHandle.values()]
    .map((mention) => mention.handle.replace(/^@/, "").trim()).filter(Boolean)
    .sort((a, b) => b.length - a.length).map(escapeRegExp)
  const pattern = new RegExp(`@(${alternatives.join("|")})(?![\\w])`, "gi")
  const segments: PostBodySegment[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > cursor) segments.push({ kind: "text", text: body.slice(cursor, match.index) })
    const matchedHandle = match[1] ?? ""
    const mention = byHandle.get(matchedHandle.toLocaleLowerCase())
    segments.push(mention
      ? { kind: "mention", text: match[0], userId: mention.id, handle: mention.handle.replace(/^@/, "") }
      : { kind: "text", text: match[0] })
    cursor = pattern.lastIndex
  }
  if (cursor < body.length) segments.push({ kind: "text", text: body.slice(cursor) })
  return segments.length > 0 ? segments : [{ kind: "text", text: body }]
}

export function repostBodyText(embedded: PostRefDTO): string {
  if (embedded.deleted) return ""
  const body = embedded.body
  if (typeof body === "string") return body
  return embedded.excerpt
}

export function repostSubjectAuthorId(post: PostDTO): string {
  if (post.kind === "repost" && post.repostOf?.author) return post.repostOf.author.id
  return post.author.id
}

export function buildPostCardModel(
  post: PostDTO,
  t: TFunction,
  options: PostCardModelOptions = {},
): PostCardModel {
  const isFix = post.report?.status === "resolved" && (post.media?.length ?? 0) > 0
  const variant: PostCardVariant = isFix ? "fix-confirmed"
    : post.kind === "repost" ? "repost"
    : post.kind === "quote" ? "quote"
    : post.kind === "reply" ? "reply"
    : post.event ? "event" : "post"
  const timeLabel = (options.timeAgo ?? listTimeAgo)(post.createdAt)
  const contextLabel = options.neighborhood?.trim() || null
  const metaLabel = [timeLabel, contextLabel].filter(Boolean).join(" · ")
  const handle = post.author.handle?.replace(/^@/, "").trim()
  const embedded = post.repostOf ?? null
  const body =
    variant === "repost" && embedded ? repostBodyText(embedded) : post.body ?? ""
  const mediaCount = post.media?.length ?? 0
  const fixLayout: PostFixLayout = !isFix ? null : mediaCount >= 2 ? "before-after" : mediaCount === 1 ? "cleared" : null
  const categoryLabel = post.report
    ? post.report.type
      ? t(`enums:reportType.${post.report.type}`)
      : t(`enums:category.${post.report.category}`)
    : null
  const showOrganizerBadge = Boolean(post.event && post.event.organizer.id === post.author.id)
  return {
    variant,
    showOrganizerBadge,
    metaLabel,
    repostAttribution: post.kind === "repost"
      ? t("post_card.repost_attribution", { name: post.author.name })
      : null,
    embeddedPost: post.repostOf ?? null,
    fixLayout,
    categoryLabel,
    reportedByLabel: options.reportedBy?.trim()
      ? t("post_card.reported_by", { name: options.reportedBy.trim().replace(/[.]+$/, "") })
      : null,
    resolutionLabel: isFix
      ? options.resolutionLabel?.trim()
        || (post.event ? t("post_card.cleared_at", { title: post.event.title }) : null)
      : null,
    handleLabel: handle && !showOrganizerBadge ? `@${handle}` : null,
    timeLabel,
    contextLabel,
    bodyExpandable: body.length > BODY_CLAMP_CHARS
      || (body.match(/\n/g)?.length ?? 0) >= POST_BODY_CLAMP_LINES,
    showFixShowcase: isFix && fixLayout !== null,
    replyingToLabel: replyingToLabel(post, t),
  }
}

function replyingToLabel(post: PostDTO, t: TFunction): string | null {
  if (post.kind !== "reply") return null
  const parentAuthor = post.replyTo?.author
  if (!parentAuthor) return null
  const handle = parentAuthor.handle?.replace(/^@/, "").trim()
  return handle
    ? t("post_card.replying_to", { handle: `@${handle}` })
    : t("post_card.replying_to", { handle: parentAuthor.name })
}
