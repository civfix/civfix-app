/**
 * In landscape web the persistent home map already fills the screen behind the form, so a location pick
 * happens on that map instead of a second inline one. The store holds only transient pick state and never
 * resolves the value itself: the LocationPicker that started the pick commits through its own `onChange`,
 * one code path for the form. `mapRegistered` lets the picker fall back to its inline map on a cold deep
 * link where no main map has mounted.
 */
import { create } from "zustand"
import { reportPinTarget, type PinTarget } from "./pins/appearance"

export interface PickDraft {
  lat: number
  lng: number
}

export interface LocationPickState {
  active: boolean
  draft: PickDraft | null
  pin: PinTarget
  mapRegistered: boolean

  start: (initial?: PickDraft | null, pin?: PinTarget) => void
  setPin: (pin: PinTarget) => void
  setDraft: (lat: number, lng: number) => void
  cancel: () => void
  setMapRegistered: (registered: boolean) => void
}

const DEFAULT_PIN: PinTarget = reportPinTarget(null)

export const useLocationPick = create<LocationPickState>((set) => ({
  active: false,
  draft: null,
  pin: DEFAULT_PIN,
  mapRegistered: false,

  start: (initial, pin) => set({ active: true, draft: initial ?? null, pin: pin ?? DEFAULT_PIN }),
  setPin: (pin) => set({ pin }),
  setDraft: (lat, lng) => set({ draft: { lat, lng } }),
  cancel: () => set({ active: false, draft: null, pin: DEFAULT_PIN }),
  setMapRegistered: (registered) => set({ mapRegistered: registered }),
}))
