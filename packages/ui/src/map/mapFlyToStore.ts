import { create } from "zustand"
import type { FocusedEntity } from "./mapFocusStore"

export type MapFlyToTarget = FocusedEntity

export type MapFlyToRequest = MapFlyToTarget & { generation: number }

export type MapFlyToHighlight = MapFlyToTarget

export interface MapFlyToState {
  request: MapFlyToRequest | null
  highlight: MapFlyToHighlight | null
  requestFlyTo: (target: MapFlyToTarget) => void
  consume: (generation: number) => void
  clear: () => void
}

let lastGeneration = 0

export const useMapFlyTo = create<MapFlyToState>((set, get) => ({
  request: null,
  highlight: null,
  requestFlyTo: (target) => {
    lastGeneration += 1
    set({
      request: { ...target, generation: lastGeneration },
      highlight: target,
    })
  },
  consume: (generation) => {
    if (get().request?.generation === generation) set({ request: null })
  },
  clear: () => {
    const state = get()
    if (state.request !== null || state.highlight !== null) set({ request: null, highlight: null })
  },
}))
