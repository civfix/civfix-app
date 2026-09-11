import type { TFunction } from "i18next"
import type { LayoutMode } from "../shell/expandedFramePlan"

export type FeedViewState = "loading" | "error" | "empty" | "loaded"

/**
 * Row entrance timing. 280 -> 200ms: with the stagger below, the LAST row of a batch used to finish at
 * 275 + 280 = 555ms, i.e. the feed was still assembling itself more than half a second after it appeared.
 * 140 + 200 = 340ms is under the ~350ms threshold where a list stops reading as "loading" and starts
 * reading as "there".
 */
export function buildFeedMotionModel(reducedMotion: boolean) {
  return reducedMotion
    ? { duration: 0, easing: "linear" as const, animated: false }
    : { duration: 200, easing: "ease-out" as const, animated: true }
}

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

/**
 * Stagger between rows entering together, and the cap on it (a batch never waits longer than this).
 * Tightened 55 -> 35 and 275 -> 140 alongside the 200ms row duration: the cap is what bounds the whole
 * batch, and at 275 the last row of a screenful started a quarter of a second after the first one. The
 * ripple is still legible at 35ms/row; it just stops being something you wait for.
 */
export const FEED_ROW_STAGGER_MS = 35
export const FEED_ROW_STAGGER_MAX_MS = 140
/** A mount this long after the batch started begins a NEW batch, at zero delay. */
export const FEED_ROW_BATCH_MS = 120

export interface FeedRowEntrance {
  /** Play the entrance: this post has never been shown in this feed mount. */
  animate: boolean
  /** How long the row waits before animating in, in ms (0 for the first row of a batch). */
  delay: number
}

/**
 * Who has already made an entrance, so the timeline animates each post EXACTLY ONCE.
 *
 * The feed is a virtualized FlatList: rows unmount when they leave the render window and remount when
 * they come back. Animating in a mount effect therefore replayed the fade/slide on every re-entry -
 * already-read posts blanked out and slid in again on the way back up. And keying the stagger to the
 * ABSOLUTE list index meant every row past the first screen mounted with the maxed-out delay, so a
 * freshly windowed post sat invisible for ~275ms mid-scroll.
 *
 * So: the entrance is claimed per post id (a recycled row renders fully visible on its first frame), and
 * the stagger counts position WITHIN THE CURRENT MOUNT BATCH - rows windowed in the same tick fan out
 * 0/55/110ms, and a batch that starts later starts at zero again.
 */
export interface FeedEntranceTracker {
  /** Whether this post has already been shown (a recycled row must not blank out and re-enter). */
  hasShown: (postId: string) => boolean
  /** Claim this post's one entrance. Repeat claims (and recycled rows) resolve to no animation. */
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
