/**
 * The in-memory post-composer draft. Keeping it in zustand, rather than component state, preserves a
 * partially written post while the composer unmounts for an event, report, or profile navigation step.
 * It deliberately stores only JSON-safe values; camera/upload hooks own the non-serializable transport work.
 */
import { create } from "zustand"
import type { LinkedEventRef, LinkedReportRef, UserMentionDTO } from "@civfix/shared"
import { registerViewerScopedDrafts } from "../viewerScope"

export type PostComposerMode = "post" | "quote" | "reply"
export type PostComposerMediaStatus = "pending" | "uploading" | "ready" | "failed"

export type PostComposerCreateKind = "report" | "event"

/**
 * The composer's armed intent to have a create flow hand its result back to this draft instead of
 * navigating to what it made. It lives on the store, not a nav entry, because opening the report wizard
 * clears the detail stack. Armed only means a launch happened; `claimedCreate` says which run owns it.
 */
export type PostComposerPendingCreate = PostComposerCreateKind | null

export interface PostComposerMedia {
  uri: string
  kind: "image" | "video"
  posterUri: string | null
  uploadId: string | null
  status: PostComposerMediaStatus
}

export interface PostComposerDraft {
  body: string
  mentionedUsers: UserMentionDTO[]
  attachedEventId: string | null
  attachedEvent: LinkedEventRef | null
  attachedReportId: string | null
  /**
   * A snapshot, like `attachedEvent`, because the id alone is cleared by `shouldClearStaleAttachedReport`
   * when the loaded `useMyReports` pages have not yet refetched a report created seconds ago.
   */
  attachedReport: LinkedReportRef | null
  media: PostComposerMedia[]
  mode: PostComposerMode
  organizationId: string | null
  quotePostId: string | null
  replyToPostId: string | null
  pendingCreate: PostComposerPendingCreate
  /**
   * The viewer who wrote the content, stamped on every content edit. A draft is shown to, submitted by
   * and restored for that viewer only; null is a signed-out author.
   */
  ownerId: string | null
}

export interface PostComposerState {
  draft: PostComposerDraft
  viewerId: string | null
  /**
   * Not on the draft because `restore` puts a captured draft back verbatim, and this describes the create
   * run on screen now rather than the user's content.
   */
  claimedCreate: PostComposerPendingCreate
  setBody: (body: string) => void
  setMentionedUsers: (users: readonly UserMentionDTO[]) => void
  setAttachedEvent: (event: LinkedEventRef | null) => void
  setAttachedReportId: (id: string | null) => void
  setAttachedReport: (report: LinkedReportRef | null) => void
  setPendingCreate: (pending: PostComposerPendingCreate) => void
  /**
   * Moves `pendingCreate` to `claimedCreate` atomically at run activation, binding the intent to one run so
   * releasing on deactivation makes an abandoned run self-healing; an unowned latch read at submit time
   * would hijack every later report. Idempotent because remounts (layout flip, keep-alive slot, StrictMode)
   * re-claim what they hold. The claimed state also vetoes the composer's exit discard, which can run after
   * the claim.
   */
  claimPendingCreate: (kind: PostComposerCreateKind) => void
  /** Kind-scoped, never a blanket clear, so a departing run cannot release a claim it does not hold. */
  releaseClaimedCreate: (kind: PostComposerCreateKind) => void
  /**
   * On a genuine close, drops what the user selected and keeps what they wrote (a product decision). The
   * mentions stay with the body because `activePostMentions` re-derives the chips from the text.
   */
  discardAttachments: () => void
  setMedia: (media: readonly PostComposerMedia[]) => void
  setMode: (mode: PostComposerMode) => void
  setOrganizationId: (organizationId: string | null) => void
  setQuotePostId: (id: string | null) => void
  setReplyToPostId: (id: string | null) => void
  /**
   * `keep` re-stamps the mounted composer's mode and target atomically with the clear: a compact reply
   * composer stays mounted across submits, and a bare reset would turn the second reply into a top-level
   * post.
   */
  reset: (keep?: { mode: PostComposerMode; targetPostId?: string | null }) => void
  /**
   * Submit clears the draft on dispatch so a dismissal mid-request cannot leave a copy to publish twice;
   * the submit path restores its captured draft here when the mutation fails.
   */
  restore: (draft: PostComposerDraft) => void
  /**
   * The draft belongs to whoever typed it. On a shared device an account switch must not hand the next
   * account the previous one's text, mentions, attachments or author organization, which it could then
   * publish under its own name, so a different signed-in viewer wipes it. A null viewer only hides it:
   * a session check that did not get an answer must not cost a signed-in author their draft.
   */
  adoptViewer: (viewerId: string | null) => void
  discardViewerDraft: () => void
}

function emptyDraft(): PostComposerDraft {
  return {
    body: "",
    mentionedUsers: [],
    attachedEventId: null,
    attachedEvent: null,
    attachedReportId: null,
    attachedReport: null,
    media: [],
    mode: "post",
    organizationId: null,
    quotePostId: null,
    replyToPostId: null,
    pendingCreate: null,
    ownerId: null,
  }
}

/** What survives a change of author: the mode and target come from the mounted composer's route. */
function routeOnly(draft: PostComposerDraft): PostComposerDraft {
  return {
    ...emptyDraft(),
    mode: draft.mode,
    quotePostId: draft.quotePostId,
    replyToPostId: draft.replyToPostId,
  }
}

function serializeMention(user: UserMentionDTO): UserMentionDTO {
  return { id: user.id, handle: user.handle, displayName: user.displayName }
}

function serializeMedia(media: PostComposerMedia): PostComposerMedia {
  return {
    uri: media.uri,
    kind: media.kind,
    posterUri: media.posterUri,
    uploadId: media.uploadId,
    status: media.status,
  }
}

function serializeEvent(event: LinkedEventRef): LinkedEventRef {
  return { ...event, organizer: { ...event.organizer } }
}

/**
 * A content edit by the current viewer. Another signed-in author's draft is left untouched (its author
 * is only momentarily unknown), and a signed-out author's content never carries over to a signed-in one.
 */
function replaceDraft(update: (draft: PostComposerDraft) => PostComposerDraft) {
  return (state: PostComposerState): Partial<PostComposerState> => {
    const { draft, viewerId } = state
    if (draft.ownerId === viewerId) return { draft: update(draft) }
    if (draft.ownerId !== null) return state
    return { draft: { ...update(routeOnly(draft)), ownerId: viewerId } }
  }
}

function ownOrganizationId(state: PostComposerState): string | null {
  return state.draft.ownerId === state.viewerId ? state.draft.organizationId : null
}

function replaceRoute(update: (draft: PostComposerDraft) => PostComposerDraft) {
  return (state: PostComposerState) => ({ draft: update(state.draft) })
}

export const usePostComposerStore = create<PostComposerState>((set) => ({
  draft: emptyDraft(),
  claimedCreate: null,
  viewerId: null,

  setBody: (body) => set(replaceDraft((draft) => ({ ...draft, body }))),

  setMentionedUsers: (users) =>
    set(replaceDraft((draft) => ({ ...draft, mentionedUsers: users.map(serializeMention) }))),

  setAttachedEvent: (event) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        attachedEventId: event?.id ?? null,
        attachedEvent: event ? serializeEvent(event) : null,
      })),
    ),

  // Setting the id alone drops a snapshot that does not belong to it, so the two never disagree.
  setAttachedReportId: (attachedReportId) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        attachedReportId,
        attachedReport: draft.attachedReport?.id === attachedReportId ? draft.attachedReport : null,
      })),
    ),

  setAttachedReport: (report) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        attachedReportId: report?.id ?? null,
        attachedReport: report ? { ...report } : null,
      })),
    ),

  setPendingCreate: (pendingCreate) => set(replaceDraft((draft) => ({ ...draft, pendingCreate }))),

  claimPendingCreate: (kind) =>
    set((state) => {
      if (state.claimedCreate === kind) return {}
      if (state.draft.pendingCreate !== kind) return {}
      return { claimedCreate: kind, draft: { ...state.draft, pendingCreate: null } }
    }),

  releaseClaimedCreate: (kind) =>
    set((state) => (state.claimedCreate === kind ? { claimedCreate: null } : {})),

  discardAttachments: () =>
    set((state) => ({
      claimedCreate: null,
      draft: {
        ...state.draft,
        attachedEventId: null,
        attachedEvent: null,
        attachedReportId: null,
        attachedReport: null,
        media: [],
        pendingCreate: null,
      },
    })),

  setMedia: (media) => set(replaceDraft((draft) => ({ ...draft, media: media.map(serializeMedia) }))),

  setMode: (mode) => set(replaceRoute((draft) => ({ ...draft, mode }))),

  setOrganizationId: (organizationId) =>
    set(replaceDraft((draft) => ({ ...draft, organizationId }))),

  setQuotePostId: (quotePostId) => set(replaceRoute((draft) => ({ ...draft, quotePostId }))),

  setReplyToPostId: (replyToPostId) => set(replaceRoute((draft) => ({ ...draft, replyToPostId }))),

  restore: (draft) => set((state) => (draft.ownerId === state.viewerId ? { draft: { ...draft } } : state)),

  adoptViewer: (viewerId) =>
    set((state) => {
      if (state.viewerId === viewerId) return state
      const owner = state.draft.ownerId
      if (viewerId === null || owner === null || owner === viewerId) return { viewerId }
      return { viewerId, claimedCreate: null, draft: routeOnly(state.draft) }
    }),

  discardViewerDraft: () => set((state) => ({ claimedCreate: null, draft: routeOnly(state.draft) })),

  reset: (keep) =>
    set((state) => ({
      // A cleared draft has no create run: whatever was armed or claimed belonged to the post that just
      // went out (or was discarded), and must not survive to route the next one.
      claimedCreate: null,
      draft: keep
        ? {
            ...emptyDraft(),
            organizationId: ownOrganizationId(state),
            ownerId: state.viewerId,
            mode: keep.mode,
            replyToPostId: keep.mode === "reply" ? (keep.targetPostId ?? null) : null,
            quotePostId: keep.mode === "quote" ? (keep.targetPostId ?? null) : null,
          }
        : { ...emptyDraft(), organizationId: ownOrganizationId(state), ownerId: state.viewerId },
    })),
}))

registerViewerScopedDrafts(usePostComposerStore, {
  discard: () => usePostComposerStore.getState().discardViewerDraft(),
  onViewer: (viewerId) => usePostComposerStore.getState().adoptViewer(viewerId),
})

const hiddenDrafts = new WeakMap<PostComposerDraft, PostComposerDraft>()

/**
 * The draft as the current viewer may see and submit it: another author's content is hidden behind the
 * route-only shell (memoized per draft so subscribers get a stable reference).
 */
export const selectPostComposerDraft = (state: PostComposerState): PostComposerDraft => {
  if (state.draft.ownerId === state.viewerId) return state.draft
  let hidden = hiddenDrafts.get(state.draft)
  if (!hidden) {
    hidden = routeOnly(state.draft)
    hiddenDrafts.set(state.draft, hidden)
  }
  return hidden
}

/**
 * Whose draft a mounted composer is showing: its author, or for an untouched draft the viewer who will
 * write it. Composers remount on it, so thumbnails they carry in local state never pass to a new owner.
 */
export const selectPostComposerDraftOwner = (state: PostComposerState): string | null =>
  state.draft.ownerId ?? state.viewerId

/** A signed-in author's draft while nobody (or another account) is the viewer: shown empty, read-only. */
export const selectPostComposerDraftHidden = (state: PostComposerState): boolean =>
  state.draft.ownerId !== null && state.draft.ownerId !== state.viewerId

export const selectPostComposerHasPendingMedia = (state: PostComposerState): boolean =>
  selectPostComposerDraft(state).media.some((media) => media.status === "pending" || media.status === "uploading")

/**
 * Whether `draft` is still the cleared slot a submit of `staged` left behind: nothing typed or attached
 * since, and the same mode and target. Anything else means the user moved on, and putting the failed
 * draft back would overwrite newer work or turn their next post into a reply to someone else.
 */
function postComposerSlotIsUntouched(draft: PostComposerDraft, staged: PostComposerDraft): boolean {
  return (
    draft.body.trim().length === 0 &&
    draft.mentionedUsers.length === 0 &&
    draft.media.length === 0 &&
    draft.attachedEventId === null &&
    draft.attachedReportId === null &&
    draft.pendingCreate === null &&
    draft.mode === staged.mode &&
    draft.replyToPostId === staged.replyToPostId &&
    draft.quotePostId === staged.quotePostId
  )
}

/**
 * Runs from the mutation promise, not a per-call `onError`, because TanStack drops per-call callbacks once
 * the composer that fired them unmounts. A draft goes back only to the viewer who wrote it, so an account
 * switch mid-request cannot hand the text to whoever is signed in now.
 */
export function restoreFailedPostSubmit(staged: PostComposerDraft): boolean {
  const { draft, viewerId, restore } = usePostComposerStore.getState()
  if (staged.ownerId !== viewerId) return false
  if (!postComposerSlotIsUntouched(draft, staged)) return false
  restore(staged)
  return true
}
