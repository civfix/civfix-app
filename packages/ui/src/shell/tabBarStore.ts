import { create } from "zustand"
import type { View } from "../nav"

export interface TabBarState {
  tabBarHeight: number
  setTabBarHeight: (height: number) => void
  lastNonSearchView: View
  noteView: (view: View) => void
}

export const useTabBarStore = create<TabBarState>((set) => ({
  tabBarHeight: 0,
  setTabBarHeight: (height) => set({ tabBarHeight: Math.max(0, Math.round(height)) }),
  lastNonSearchView: "home",
  noteView: (view) =>
    set((s) => (view === "search" || s.lastNonSearchView === view ? s : { lastNonSearchView: view })),
}))
