import { create } from "zustand"

export interface MapFlyToTarget {
  kind: "report" | "cleanup"
  id: string
  lat: number
  lng: number
}

export interface MapFlyToRequest extends MapFlyToTarget {
  generation: number
}

export interface MapFlyToHighlight {
  kind: MapFlyToTarget["kind"]
  id: string
}

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
      highlight: { kind: target.kind, id: target.id },
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
