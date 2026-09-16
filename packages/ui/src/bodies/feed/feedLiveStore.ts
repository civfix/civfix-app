import { create } from "zustand"
import { addPendingNewPost } from "./feedLiveModel"

const NO_PENDING: readonly string[] = []

export interface FeedLiveState {
  pendingNewPostIds: readonly string[]
  noteNewPost: (id: string) => void
  clearNewPosts: () => void
}

export const useFeedLiveStore = create<FeedLiveState>((set, get) => ({
  pendingNewPostIds: NO_PENDING,
  noteNewPost: (id) => {
    const prev = get().pendingNewPostIds
    const next = addPendingNewPost(prev, id)
    if (next !== prev) set({ pendingNewPostIds: next })
  },
  clearNewPosts: () => {
    if (get().pendingNewPostIds.length === 0) return
    set({ pendingNewPostIds: NO_PENDING })
  },
}))
