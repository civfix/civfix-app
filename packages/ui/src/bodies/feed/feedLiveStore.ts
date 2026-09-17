import { create } from "zustand"
import { addPendingNewPost } from "./feedLiveModel"

const NO_PENDING: readonly string[] = []

const NO_VIEWER = Symbol("no-viewer")

export interface FeedLiveState {
  pendingNewPostIds: readonly string[]
  viewerId: string | null | typeof NO_VIEWER
  noteNewPost: (id: string) => void
  clearNewPosts: () => void
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
