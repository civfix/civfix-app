/**
 * Deliberately not `useMapFocus`: both map seams render exactly one marker while a focus is set, so a
 * dropped pin expressed as focus would hide every other pin. The seams draw this pin as a sibling of
 * their normal marker tree.
 *
 * Coordinates are rounded to 6dp so the web and native projections produce the same value for one spot,
 * and so `drop` is idempotent: a StrictMode double-invoke cannot churn the seams' marker subtrees.
 */
import { create } from "zustand"

export interface DroppedPin {
  lat: number
  lng: number
}

export interface DroppedPinState {
  pin: DroppedPin | null
  drop: (lat: number, lng: number) => void
  clear: () => void
}

/** ~11cm at the equator. */
export const DROPPED_PIN_PRECISION = 6

const FACTOR = 10 ** DROPPED_PIN_PRECISION

/** Normalises -0 to 0 so idempotence holds under `Object.is`. */
function round6(value: number): number {
  if (!Number.isFinite(value)) return value
  const rounded = Math.round(value * FACTOR) / FACTOR
  return rounded === 0 ? 0 : rounded
}

export const useDroppedPin = create<DroppedPinState>((set) => ({
  pin: null,
  drop: (lat, lng) =>
    set((state) => {
      const next = { lat: round6(lat), lng: round6(lng) }
      const current = state.pin
      // Both seams key their transient marker off this identity, so an unchanged point returns the same state.
      if (current && current.lat === next.lat && current.lng === next.lng) return state
      return { pin: next }
    }),
  clear: () => set((state) => (state.pin === null ? state : { pin: null })),
}))
