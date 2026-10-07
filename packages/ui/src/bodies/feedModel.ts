import type { TFunction } from "i18next"
import { tokens } from "@civfix/shared/tokens"
import type { LayoutMode } from "../nav"

export type FeedViewState = "loading" | "error" | "empty" | "loaded"

export const POST_LIST_END_REACHED_THRESHOLD = 0.6

/**
 * The row duration plus the stagger cap below (200 + 140 = 340ms) must stay under ~350ms, past which a
 * list reads as still loading rather than there.
 */
export const FEED_ROW_ENTER_MS = tokens.motion.dur.d2

export function buildFeedHeaderModel(
  { isAuthenticated, layout }: { isAuthenticated: boolean; layout: LayoutMode },
  t: TFunction,
) {
  return {
    title: t("feed.title"),
    showComposer: isAuthenticated && layout === "compact",
    showInlineComposer: isAuthenticated && layout === "expanded",
  }
}

/** The cap bounds the whole batch against the 350ms budget above; 35ms/row still reads as a ripple. */
export const FEED_ROW_STAGGER_MS = 35
export const FEED_ROW_STAGGER_MAX_MS = 140
/** A mount this long after the batch started begins a NEW batch, at zero delay. */
export const FEED_ROW_BATCH_MS = 120

export interface FeedRowEntrance {
  animate: boolean
  delay: number
}

/**
 * The feed is a virtualized FlatList, so rows remount on every re-entry: the entrance is claimed per post
 * id so a recycled row renders fully visible instead of replaying. The stagger counts position within the
 * current mount batch, not the list index, or every row past the first screen would wait the full cap.
 */
export interface FeedEntranceTracker {
  hasShown: (postId: string) => boolean
  claim: (postId: string, now: number) => FeedRowEntrance
}

export function createFeedEntranceTracker(): FeedEntranceTracker {
  const shown = new Set<string>()
  let batchStartedAt: number | null = null
  let batchCount = 0
  return {
    hasShown: (postId) => shown.has(postId),
    claim: (postId, now) => {
      if (shown.has(postId)) return { animate: false, delay: 0 }
      shown.add(postId)
      if (batchStartedAt == null || now - batchStartedAt > FEED_ROW_BATCH_MS) {
        batchStartedAt = now
        batchCount = 0
      }
      const delay = Math.min(batchCount * FEED_ROW_STAGGER_MS, FEED_ROW_STAGGER_MAX_MS)
      batchCount += 1
      return { animate: true, delay }
    },
  }
}

export function feedViewState({
  isLoading,
  isError,
  postCount,
}: {
  isLoading: boolean
  isError: boolean
  postCount: number
}): FeedViewState {
  if (postCount > 0) return "loaded"
  if (isLoading) return "loading"
  if (isError) return "error"
  return "empty"
}

export type FeedFooterState = "loading-more" | "load-more-failed" | "caught-up" | "idle"

/**
 * A failed `fetchNextPage` leaves `hasNextPage` true and the list length unchanged, so FlatList never fires
 * `onEndReached` again; the footer needs its own failed state or the feed silently stops.
 */
export function feedFooterState({
  state,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
}: {
  state: FeedViewState
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  hasNextPage: boolean
}): FeedFooterState {
  if (state !== "loaded") return "idle"
  if (isFetchingNextPage) return "loading-more"
  if (isFetchNextPageError) return "load-more-failed"
  if (!hasNextPage) return "caught-up"
  return "idle"
}

export type PostDetailViewState = "loading" | "error" | "ready"

/**
 * Only an actual failure (or no id at all) is an error. A query that is still pending but not fetching,
 * such as one paused while offline, is still loading and must not read as "This post couldn't be loaded".
 */
export function postDetailViewState({
  hasId,
  hasData,
  isError,
}: {
  hasId: boolean
  hasData: boolean
  isError: boolean
}): PostDetailViewState {
  if (hasData) return "ready"
  if (isError || !hasId) return "error"
  return "loading"
}
