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

/** The two things the composer can leave to create and come back with attached. */
export type PostComposerCreateKind = "report" | "event"

/**
 * The composer's "I sent you off to create something - come back here when you're done" intent, ARMED.
 *
 * Neither create flow has a return channel of its own: the report wizard ends with
 * `nav.reset(); push({kind:"pin"})` and the event form ends with `pushCleanup(...)`. Both SELF-navigate to
 * the thing they just made. This flag is what lets them do something else instead: the composer sets it
 * before launching, the flow reads it on success, attaches its result to this draft and returns here.
 *
 * It lives on the STORE rather than on the nav entry because launching the report wizard is
 * `selectView("report")`, which CLEARS the detail stack - any intent parked on a nav entry would be
 * destroyed by the very navigation it needs to survive. The draft is module-level and already survives
 * that same trip, which is what makes the round trip work at all.
 *
 * ARMED IS NOT THE SAME AS RUNNING. This field says only "a launch just happened"; it is one commit old by
 * the time the flow it launched is on screen, and `claimedCreate` is what says "and THAT run owns it". See
 * {@link PostComposerState.claimPendingCreate} for why the two halves exist.
 */
export type PostComposerPendingCreate = PostComposerCreateKind | null

/** A local preview reference plus the finalized upload identity once the media pipeline completes. */
export interface PostComposerMedia {
  uri: string
  kind: "image" | "video"
  posterUri: string | null
  uploadId: string | null
  status: PostComposerMediaStatus
}

/** All durable composer inputs, intentionally limited to serializable primitives and arrays. */
export interface PostComposerDraft {
  body: string
  mentionedUsers: UserMentionDTO[]
  attachedEventId: string | null
  attachedEvent: LinkedEventRef | null
  attachedReportId: string | null
  /**
   * A SNAPSHOT of the attached report, mirroring `attachedEvent`.
   *
   * The id alone is not enough for a report the composer just created. The composer resolves an attached
   * report out of the loaded `useMyReports` pages and CLEARS the id when it cannot find one there
   * (`shouldClearStaleAttachedReport`) - so a report created seconds ago, before the invalidated query has
   * refetched, would be silently detached from the draft that asked for it. The event side has never had
   * this problem precisely because it snapshots. Now both do.
   */
  attachedReport: LinkedReportRef | null
  media: PostComposerMedia[]
  mode: PostComposerMode
  organizationId: string | null
  quotePostId: string | null
  replyToPostId: string | null
  /**
   * See `PostComposerPendingCreate`. Cleared by the run that CLAIMS it (`claimPendingCreate`), by a genuine
   * composer exit (`discardAttachments`), and by `reset`.
   */
  pendingCreate: PostComposerPendingCreate
  /**
   * The viewer who wrote the content, stamped on every content edit. A draft is shown to, submitted by
   * and restored for that viewer only; null is a signed-out author.
   */
  ownerId: string | null
}

export interface PostComposerState {
  draft: PostComposerDraft
  /** Who is using the composer now, as the host's auth layer reports it (null when signed out). */
  viewerId: string | null
  /**
   * The LIVE create run: the armed intent, transitioned onto the flow run that actually picked it up.
   *
   * NOT on the draft, deliberately. The draft is the user's serializable content (and `restore` puts a
   * captured copy of it back verbatim); this is session machinery describing a run that is on screen right
   * now, so it is owned by the store rather than by the text it will return to.
   */
  claimedCreate: PostComposerPendingCreate
  setBody: (body: string) => void
  setMentionedUsers: (users: readonly UserMentionDTO[]) => void
  toggleMention: (user: UserMentionDTO) => void
  setAttachedEventId: (id: string | null) => void
  setAttachedEvent: (event: LinkedEventRef | null) => void
  setAttachedReportId: (id: string | null) => void
  /** Attach a report BY SNAPSHOT (the create-and-return path). Sets `attachedReportId` in lock-step. */
  setAttachedReport: (report: LinkedReportRef | null) => void
  setPendingCreate: (pending: PostComposerPendingCreate) => void
  /**
   * A create RUN takes ownership of the armed intent: `pendingCreate` -> `claimedCreate`, atomically.
   *
   * WHY A CLAIM AND NOT A BARE READ. `pendingCreate` is a module-level latch with no owner, and the report
   * wizard used to consult it at SUBMIT time - which asks "is the flag set?" when the question is "was THIS
   * wizard run launched from the composer?". Nothing cleared it when the launched run was abandoned, so one
   * "+ New report" the user backed out of hijacked every later report in the session into the composer (and
   * silently suppressed its "Share to the feed" toggle). Claiming at run ACTIVATION binds the intent to one
   * run, and releasing on deactivation is what makes abandonment self-healing.
   *
   * IDEMPOTENT, and that is load-bearing: the claim is NOT consumed, so a run that remounts (a layout flip,
   * the native shell's keyed keep-alive slot, React StrictMode's double-invoked effects) re-claims what it
   * already holds instead of losing the round trip. A claim with nothing armed - and nothing already claimed
   * for this kind - does nothing, which is exactly the stale-latch case.
   *
   * BOTH STATES BLOCK THE COMPOSER'S EXIT DISCARD (`postComposerExit`). Claiming must not look like "no
   * round trip in flight" to the composer's deferred unmount cleanup, which can evaluate AFTER the claim:
   * on mobile `leaveForCreate` pops `/compose` and selects the report view in the same tick, so the wizard's
   * claim runs first and a claim that merely nulled `pendingCreate` would have the composer throw away the
   * attachments the run is about to hand back.
   */
  claimPendingCreate: (kind: PostComposerCreateKind) => void
  /**
   * Give the claim up: the run completed (its result is attached) or was ABANDONED (its surface stopped
   * being the one on screen). KIND-SCOPED, never a blanket clear - the same `clearFor(id)` discipline
   * `shell/pageActive` documents, so a departing run cannot release a claim it does not hold.
   */
  releaseClaimedCreate: (kind: PostComposerCreateKind) => void
  /**
   * GENUINE EXIT: the composer was closed rather than temporarily left. Drops what the user SELECTED for
   * this post - attachments, staged media, and any create intent - and keeps what they WROTE.
   *
   * `body` + `mentionedUsers` stay together on purpose: `activePostMentions` re-derives the live mentions
   * from the body text, so dropping the mention records while keeping the text would break the chips the
   * draft still renders. The typed text surviving a close is a product decision (it is a draft); everything
   * here is what must NOT be silently re-attached to the next post the user opens.
   */
  discardAttachments: () => void
  setMedia: (media: readonly PostComposerMedia[]) => void
  addMedia: (media: PostComposerMedia) => void
  setMediaUpload: (uri: string, uploadId: string | null, status: PostComposerMediaStatus) => void
  setMediaStatus: (uri: string, status: PostComposerMediaStatus) => void
  removeMedia: (uri: string) => void
  setMode: (mode: PostComposerMode) => void
  setOrganizationId: (organizationId: string | null) => void
  setQuotePostId: (id: string | null) => void
  setReplyToPostId: (id: string | null) => void
  /**
   * Clear the draft. `keep` re-stamps the mounted composer's mode + target ATOMICALLY with the clear:
   * a compact reply composer stays mounted across submits, and a bare reset would flip the draft back to
   * mode "post" with no reply target — silently turning the SECOND reply into a top-level post.
   */
  reset: (keep?: { mode: PostComposerMode; targetPostId?: string | null }) => void
  /**
   * Put a previously captured draft back.
   *
   * Submitting CLEARS the draft on dispatch rather than on success, so that dismissing the composer while
   * the request is in flight cannot leave a staged copy behind to be published twice. The cost of that is
   * that a FAILED create would otherwise take the user's text with it, so the submit path captures the
   * draft first and restores it here when the mutation errors.
   */
  restore: (draft: PostComposerDraft) => void
  /**
   * The draft belongs to whoever typed it. On a shared device an account switch must not hand the next
   * account the previous one's text, mentions, attachments or author organization, which it could then
   * publish under its own name, so a different signed-in viewer wipes it. A null viewer only hides it:
   * a session check that did not get an answer must not cost a signed-in author their draft.
   */
  adoptViewer: (viewerId: string | null) => void
  /** An explicit sign-out: wipe what the viewer wrote, keeping only the mounted composer's route. */
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

  toggleMention: (user) =>
    set(
      replaceDraft((draft) => {
        const mentioned = draft.mentionedUsers
        return {
          ...draft,
          mentionedUsers: mentioned.some((item) => item.id === user.id)
            ? mentioned.filter((item) => item.id !== user.id)
            : [...mentioned, serializeMention(user)],
        }
      }),
    ),

  setAttachedEventId: (attachedEventId) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        attachedEventId,
        attachedEvent: draft.attachedEvent?.id === attachedEventId ? draft.attachedEvent : null,
      })),
    ),

  setAttachedEvent: (event) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        attachedEventId: event?.id ?? null,
        attachedEvent: event ? serializeEvent(event) : null,
      })),
    ),

  // Setting the id alone DROPS any stale snapshot that does not belong to it, so the two can never
  // disagree about which report is attached (the mirror of setAttachedEventId's guard).
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

  addMedia: (media) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        media: [...draft.media.filter((item) => item.uri !== media.uri), serializeMedia(media)],
      })),
    ),

  setMediaUpload: (uri, uploadId, status) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        media: draft.media.map((item) => (item.uri === uri ? { ...item, uploadId, status } : item)),
      })),
    ),

  setMediaStatus: (uri, status) =>
    set(
      replaceDraft((draft) => ({
        ...draft,
        media: draft.media.map((item) => (item.uri === uri ? { ...item, status } : item)),
      })),
    ),

  removeMedia: (uri) => set(replaceDraft((draft) => ({ ...draft, media: draft.media.filter((item) => item.uri !== uri) }))),

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

/** Lightweight selectors keep components from repeating submission and reference-mode derivation. */
export const selectPostComposerMentionedUserIds = (state: PostComposerState): string[] =>
  selectPostComposerDraft(state).mentionedUsers.map((user) => user.id)

export const selectPostComposerMediaUploadIds = (state: PostComposerState): string[] =>
  selectPostComposerDraft(state).media.flatMap((media) => (media.status === "ready" && media.uploadId ? [media.uploadId] : []))

export const selectPostComposerHasPendingMedia = (state: PostComposerState): boolean =>
  selectPostComposerDraft(state).media.some((media) => media.status === "pending" || media.status === "uploading")

export const selectPostComposerTargetId = (state: PostComposerState): string | null => {
  if (state.draft.mode === "quote") return state.draft.quotePostId
  if (state.draft.mode === "reply") return state.draft.replyToPostId
  return null
}
