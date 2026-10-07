"use client"

import { create } from "zustand"

/**
 * The shared MapControls render in the AppShell `mapControls` slot while the Map lives in the separate
 * `map` slot (its own `dynamic(ssr:false)` chunk on web), so the Locate button cannot hold the map's ref
 * the way mobile does. HomeMap registers its recenter here on mount and clears it on unmount.
 */
export interface MapRecenterState {
  recenter: (() => void) | null
  setRecenter: (fn: (() => void) | null) => void
}

export const useMapRecenterStore = create<MapRecenterState>((set) => ({
  recenter: null,
  setRecenter: (fn) => set({ recenter: fn }),
}))
