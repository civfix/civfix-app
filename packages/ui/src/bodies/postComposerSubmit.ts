/**
 * postComposerSubmit - the pure routing brain for the post composer's submit affordance.
 *
 * Mirrors `composerSubmit.ts` (the chat composer's `resolveComposerSubmit`): a single, unit-testable
 * (draft, hasReadyMedia) -> decision so `PostComposer`'s press handler and its Post-button `disabled`
 * prop share one truth. A post may carry a body, an attached event/report, media, or a reference
 * (quote/reply), and the shared `PostComposeInputSchema` refinement requires SOMETHING - so an empty
 * draft is blocked, and a draft whose only content is media that has not finished uploading is blocked
 * until the uploads finalize (the caller stamps the finalized `mediaUploadIds` into the input).
 *
 * Deliberately NOT here: transport concerns the caller owns (running the upload, resolving the viewer as
 * the author, re-filtering mentions to handles still present in the body, the create mutation itself).
 * This stays a pure (draft) -> action map.
 */
import type { PostComposeInput, PostKind } from "@civfix/shared"

export type PostSubmitDestination = "origin" | "thread"

export function postSubmitDestination(kind: PostKind): PostSubmitDestination {
  return kind === "post" ? "origin" : "thread"
}

/** The composer's editable draft - the fields that decide whether (and as what) a post can be submitted. */
export interface PostDraft {
  /** The free-form body text (may contain @mentions). */
  body: string
  /** An attached event the author is attending/hosting (its id), or null/undefined for none. */
  eventId?: string | null
  /** An attached/referenced report (its id), or null/undefined for none. */
  reportId?: string | null
  /** How many media attachments the user has STAGED (may still be uploading). */
  mediaCount?: number
  /** The finalized media upload ids to claim (the caller sets these once the uploads finish). */
  mediaUploadIds?: string[]
  /** The post kind. Defaults to "post"; "quote"/"reply" carry a reference below. */
  kind?: PostKind
  /** The parent post id for a reply (kind:"reply"). */
  replyToId?: string | null
  /** The quoted post id for a quote (kind:"quote"). */
  repostOfId?: string | null
  /** The resolved @mention user ids to persist. */
  mentionedUserIds?: string[]
  /** The organization the post is published as, or null/undefined to post as the acting person. */
  organizationId?: string | null
}

/**
 * The submit decision. `submit` carries the ready-to-send `PostComposeInput`; the two `blocked-*`
 * variants map to a disabled Post button (empty draft) or a "still uploading" hold (media pending).
 */
export type PostSubmitResolution =
  | { action: "submit"; input: PostComposeInput }
  | { action: "blocked-empty" }
  | { action: "blocked-media-pending" }

/**
 * Resolve what pressing the composer's Post button should do right now (and, by extension, whether it is
 * enabled - the two `blocked-*` actions = disabled). `hasReadyMedia` is the "all staged attachments have
 * finished uploading" flag; while media is staged but not ready the post is held (`blocked-media-pending`).
 */
export function resolvePostSubmit(draft: PostDraft, hasReadyMedia = false): PostSubmitResolution {
  const body = draft.body.trim()
  const hasBody = body.length > 0
  const hasAttachment = Boolean(draft.eventId) || Boolean(draft.reportId)
  const wantsMedia = (draft.mediaCount ?? 0) > 0

  // Nothing to post at all -> the Post button is disabled.
  if (!hasBody && !hasAttachment && !wantsMedia) return { action: "blocked-empty" }
  // The only/some content is media still uploading -> hold until it finalizes.
  if (wantsMedia && !hasReadyMedia) return { action: "blocked-media-pending" }

  const input: PostComposeInput = {
    kind: draft.kind ?? "post",
    ...(hasBody ? { body } : {}),
    ...(draft.replyToId ? { replyToId: draft.replyToId } : {}),
    ...(draft.repostOfId ? { repostOfId: draft.repostOfId } : {}),
    ...(draft.eventId ? { eventId: draft.eventId } : {}),
    ...(draft.reportId ? { reportId: draft.reportId } : {}),
    mediaUploadIds: draft.mediaUploadIds ?? [],
    mentionedUserIds: draft.mentionedUserIds ?? [],
    ...(draft.organizationId && draft.kind !== "repost"
      ? { organizationId: draft.organizationId }
      : {}),
  }
  return { action: "submit", input }
}
