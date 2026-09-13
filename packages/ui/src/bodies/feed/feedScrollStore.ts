import { create } from "zustand"

export interface FeedScrollTopState {
  pending: boolean
  requestScrollTop: () => void
  clearScrollTop: () => void
}

export const useFeedScrollTopStore = create<FeedScrollTopState>((set, get) => ({
  pending: false,
  requestScrollTop: () => {
    if (!get().pending) set({ pending: true })
  },
  clearScrollTop: () => {
    if (get().pending) set({ pending: false })
  },
}))
