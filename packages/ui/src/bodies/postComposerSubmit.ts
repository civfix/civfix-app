/**
 * One draft -> decision for the Post button, shared by the press handler and its `disabled` prop.
 * `PostComposeInputSchema` requires some content, and media must finalize before submit because the caller
 * can only stamp finalized `mediaUploadIds` into the input.
 */
import type { PostComposeInput, PostKind } from "@civfix/shared"

export type PostSubmitDestination = "origin" | "thread"

/**
 * `PostComposeInputSchema` caps `mentionedUserIds` at 20. A body naming more still publishes; the handles
 * past the cap stay plain text instead of the whole post failing with the generic submit error.
 */
export const POST_MENTION_CAP = 20

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
