/**
 * The reply composer's draft, KEYED BY THE POST BEING REPLIED TO.
 *
 * WHY A SECOND STORE INSTEAD OF `postComposerStore`: that store holds exactly ONE module-level draft
 * (`postComposerStore.ts`), shared by the feed composer, the quote composer and every reply bar, and the
 * composer re-stamps `mode`/`replyToPostId` on every mount. Opening a reply bar while a half-written
 * top-level post was staged would therefore silently re-aim that body at the reply target. Keying by
 * target id makes it structurally impossible: two threads cannot see each other's text, and `/compose`
 * keeps `postComposerStore` entirely to itself.
 *
 * It also means leaving a thread mid-reply and coming back RESTORES what you wrote, instead of discarding
 * it.
 *
 * EVICTION: unbounded growth would be a leak (every thread you open and type into forever). On every
 * write, if the map exceeds MAX_REPLY_DRAFTS the oldest EMPTY draft is dropped first - a draft nobody
 * would miss - and only when nothing is empty does the oldest non-empty one go.
 *
 * MEDIA is filtered to `status === "ready"` AT WRITE TIME. An item whose upload never finalized cannot be
 * resumed (the prepared bytes live in the mount that picked them, not in this JSON-only draft), so
 * carrying one forward would leave a thumbnail spinning forever over a permanently disabled Reply button.
 */
import { create } from "zustand"
import type { LinkedEventRef, UserMentionDTO } from "@civfix/contract"
import type { PostComposerMedia } from "../postComposerStore"
import { registerViewerScopedDrafts } from "../../viewerScope"

/** One thread's in-progress reply. Deliberately JSON-safe: no upload closures, no React state. */
export interface ReplyDraft {
  body: string
  mentionedUsers: UserMentionDTO[]
  /** Only FINALIZED (`status: "ready"`) media - see the file header. */
  media: PostComposerMedia[]
  attachedEventId: string | null
  attachedEvent: LinkedEventRef | null
  attachedReportId: string | null
  /** Last-write timestamp; the eviction order. */
  updatedAt: number
}

/** How many per-thread drafts are retained before the oldest is evicted. */
export const MAX_REPLY_DRAFTS = 20

/** The draft `get()` returns for a thread nobody has typed into. Frozen: it is handed out by reference. */
export const EMPTY_REPLY_DRAFT: ReplyDraft = Object.freeze({
  body: "",
  mentionedUsers: [],
  media: [],
  attachedEventId: null,
  attachedEvent: null,
  attachedReportId: null,
  updatedAt: 0,
})

export interface ReplyDraftState {
  drafts: Record<string, ReplyDraft>
  /** The draft for `targetId`, or `EMPTY_REPLY_DRAFT` when there is none. Never undefined. */
  get: (targetId: string) => ReplyDraft
  setBody: (targetId: string, body: string) => void
  setMentionedUsers: (targetId: string, users: readonly UserMentionDTO[]) => void
  setMedia: (targetId: string, media: readonly PostComposerMedia[]) => void
  setAttachedEvent: (targetId: string, event: LinkedEventRef | null) => void
  setAttachedReportId: (targetId: string, id: string | null) => void
  clearDraft: (targetId: string) => void
}

/** Whether a draft holds nothing the viewer would miss (the preferred eviction victim). */
function isEmptyDraft(draft: ReplyDraft): boolean {
  return (
    draft.body === "" &&
    draft.media.length === 0 &&
    draft.attachedEventId === null &&
    draft.attachedReportId === null
  )
}

/**
 * Drop entries until the map is back within MAX_REPLY_DRAFTS: the oldest EMPTY draft first, and only
 * when nothing is empty, the oldest draft outright. Returns the SAME object when nothing was evicted.
 */
function evict(drafts: Record<string, ReplyDraft>): Record<string, ReplyDraft> {
  if (Object.keys(drafts).length <= MAX_REPLY_DRAFTS) return drafts
  const next = new Map(Object.entries(drafts))
  while (next.size > MAX_REPLY_DRAFTS) {
    let victim: string | null = null
    let victimAt = Number.POSITIVE_INFINITY
    let victimEmpty = false
    for (const [key, draft] of next) {
      const empty = isEmptyDraft(draft)
      // An empty draft always beats a non-empty one; between two of the same kind, the older loses.
      const better = victim === null || (empty && !victimEmpty) || (empty === victimEmpty && draft.updatedAt < victimAt)
      if (better) {
        victim = key
        victimAt = draft.updatedAt
        victimEmpty = empty
      }
    }
    if (victim === null) break
    next.delete(victim)
  }
  return Object.fromEntries(next)
}

/** Apply `patch` to one target's draft (creating it from EMPTY_REPLY_DRAFT), stamp it, then evict. */
function writeDraft(
  state: ReplyDraftState,
  targetId: string,
  patch: Partial<Omit<ReplyDraft, "updatedAt">>,
): { drafts: Record<string, ReplyDraft> } {
  const current = state.drafts[targetId] ?? EMPTY_REPLY_DRAFT
  const next: ReplyDraft = { ...current, ...patch, updatedAt: Date.now() }
  return { drafts: evict({ ...state.drafts, [targetId]: next }) }
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

export const useReplyDraftStore = create<ReplyDraftState>((set, get) => ({
  drafts: {},

  get: (targetId) => get().drafts[targetId] ?? EMPTY_REPLY_DRAFT,

  setBody: (targetId, body) => set((state) => writeDraft(state, targetId, { body })),

  setMentionedUsers: (targetId, users) =>
    set((state) => writeDraft(state, targetId, { mentionedUsers: users.map(serializeMention) })),

  setMedia: (targetId, media) =>
    set((state) =>
      writeDraft(state, targetId, {
        // See the file header: an unfinalized upload can never be resumed from a JSON draft.
        media: media.filter((item) => item.status === "ready").map(serializeMedia),
      }),
    ),

  setAttachedEvent: (targetId, event) =>
    set((state) =>
      writeDraft(state, targetId, {
        attachedEventId: event?.id ?? null,
        attachedEvent: event ? { ...event, organizer: { ...event.organizer } } : null,
      }),
    ),

  setAttachedReportId: (targetId, id) =>
    set((state) => writeDraft(state, targetId, { attachedReportId: id })),

  clearDraft: (targetId) =>
    set((state) => {
      if (!(targetId in state.drafts)) return state
      const { [targetId]: _cleared, ...drafts } = state.drafts
      return { drafts }
    }),
}))

registerViewerScopedDrafts(useReplyDraftStore, {
  discard: () => useReplyDraftStore.setState({ drafts: {} }),
})
