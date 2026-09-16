import { create } from "zustand"
import { addPendingNewPost } from "./feedLiveModel"

const NO_PENDING: readonly string[] = []

const NO_VIEWER = Symbol("no-viewer")

export interface FeedLiveState {
  pendingNewPostIds: readonly string[]
  /** The viewer the pending ids belong to. `NO_VIEWER` until the feed first reports one. */
  viewerId: string | null | typeof NO_VIEWER
  noteNewPost: (id: string) => void
  clearNewPosts: () => void
  /**
   * Adopt the signed-in viewer. The store is a module singleton that deliberately OUTLIVES a FeedBody
   * remount, so a sign-out (or an account switch) has to drop the previous identity's pending ids
   * explicitly - otherwise one account's "N new posts" count greets the next one.
   */
  adoptViewer: (viewerId: string | null) => void
}

export const useFeedLiveStore = create<FeedLiveState>((set, get) => ({
  pendingNewPostIds: NO_PENDING,
  viewerId: NO_VIEWER,
  noteNewPost: (id) => {
    const prev = get().pendingNewPostIds
    const next = addPendingNewPost(prev, id)
    if (next !== prev) set({ pendingNewPostIds: next })
  },
  clearNewPosts: () => {
    if (get().pendingNewPostIds.length === 0) return
    set({ pendingNewPostIds: NO_PENDING })
  },
  adoptViewer: (viewerId) => {
    if (get().viewerId === viewerId) return
    set({ viewerId, pendingNewPostIds: NO_PENDING })
  },
}))
