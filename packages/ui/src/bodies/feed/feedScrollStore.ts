import { create } from "zustand"

export interface FeedScrollTopState {
  requestId: number
  requestScrollTop: () => void
}

export const useFeedScrollTopStore = create<FeedScrollTopState>((set, get) => ({
  requestId: 0,
  requestScrollTop: () => set({ requestId: get().requestId + 1 }),
}))
