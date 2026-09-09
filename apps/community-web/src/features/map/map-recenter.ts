"use client"

import { create } from "zustand"

/**
 * Cross-slot map "recenter" bus (UI-unification Stage 4 slice 5B-1).
 *
 * The shared MapControls live in the AppShell `mapControls` slot while the shared <Map/> lives in the
 * separate `map` slot (a distinct `dynamic(ssr:false)` chunk on web), so the controls cannot hold the
 * map's imperative ref directly the way the mobile screen does (there both are children of one
 * component). This tiny zustand bus bridges them: HomeMap REGISTERS a `recenter` function (resolve a
 * fresh user location -> fly there) on mount and clears it on unmount; the MapControls Locate button
 * READS it and invokes it. Null while no map is mounted, so the button is a safe no-op then.
 */
export interface MapRecenterState {
  /** The current map's recenter action (resolve a fresh location and fly to it), or null if no map. */
  recenter: (() => void) | null
  /** HomeMap registers / clears its recenter on mount / unmount. */
  setRecenter: (fn: (() => void) | null) => void
}

export const useMapRecenterStore = create<MapRecenterState>((set) => ({
  recenter: null,
  setRecenter: (fn) => set({ recenter: fn }),
}))
