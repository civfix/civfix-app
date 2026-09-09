/**
 * The shared "pick a location ON THE MAIN MAP" bus (event-linking UX follow-up 2).
 *
 * On web in LANDSCAPE the persistent home map fills the screen behind the host/report sidebar, so a second
 * inline 200px pin-drop map (LocationPicker's standalone mode) is redundant - the user should just tap the
 * BIG map they are already looking at. This tiny zustand store bridges the two SHARED components that must
 * cooperate without either importing the app:
 *   - the shared <Map/> (.web seam) REGISTERS itself (`setMapRegistered`) on mount, renders a PREVIEW pin
 *     at `draft` while a pick is `active`, and routes an empty-canvas tap to `setDraft(lat,lng)`;
 *   - the shared <LocationPicker/> (.web seam, mode "main-map") STARTS a pick on enter, reads `draft` to
 *     echo + LIVE-COMMIT each new point to its own `onChange`, and ends the pick (`cancel`) on unmount.
 *
 * The store holds ONLY the transient pick state (active / draft / whether a main map is mounted). It does
 * NOT call any onChange itself - the LocationPicker that started the pick owns that resolution, so the
 * coordinate flows back through the same `onChange` the standalone picker uses (one code path for the
 * form). `mapRegistered` lets the LocationPicker fall back to its own inline map for a cold deep-link
 * (the picker mounted before any main map did, e.g. the /host route opened directly).
 *
 * Pure zustand (mirrors filterStore.ts) - no next / expo / react-native / maplibre - so it unit-tests
 * directly and both seam files (.web map + .web picker) may import it.
 */
import { create } from "zustand"

/** A simple lat/lng draft point the main map previews and the picker echoes / resolves. */
export interface PickDraft {
  lat: number
  lng: number
}

export interface LocationPickState {
  /** Whether a "pick on the main map" is in progress (a LocationPicker in main-map mode is mounted/active). */
  active: boolean
  /** The pending point (the last main-map tap or the initial value), or null when nothing is placed yet. */
  draft: PickDraft | null
  /**
   * Whether a SHARED <Map/> has registered itself as the active main map. The LocationPicker only delegates
   * to the main map (renders its overlay instead of an inline map) when this is true; otherwise it falls
   * back to its own inline map (a cold deep-link before the home map mounts).
   */
  mapRegistered: boolean

  /** Begin a pick (the picker calls this on enter), seeding the draft with the current value if any. */
  start: (initial?: PickDraft | null) => void
  /** Move the pending point (a main-map tap, or an AddressSearch pick syncing the preview pin). */
  setDraft: (lat: number, lng: number) => void
  /**
   * End the pick + clear active/draft. NOTE: the web picker now commits each tap LIVE via `onChange` and
   * ends the pick via `cancel` on unmount, so `confirm` is currently UNUSED in production (retained for a
   * possible future explicit-confirm UX and exercised by the store unit test). Identical reset to `cancel`.
   */
  confirm: () => void
  /** End the pick (the web picker calls this on unmount). Clears active + draft (same reset as confirm). */
  cancel: () => void
  /** The shared <Map/> registers / unregisters itself on mount / unmount. */
  setMapRegistered: (registered: boolean) => void
}

export const useLocationPick = create<LocationPickState>((set) => ({
  active: false,
  draft: null,
  mapRegistered: false,

  start: (initial) => set({ active: true, draft: initial ?? null }),
  setDraft: (lat, lng) => set({ draft: { lat, lng } }),
  // confirm + cancel both just END the pick (identical state reset). The web picker now commits each tap
  // live via onChange and only calls cancel() (on unmount); confirm() is retained but currently unused.
  confirm: () => set({ active: false, draft: null }),
  cancel: () => set({ active: false, draft: null }),
  setMapRegistered: (registered) => set({ mapRegistered: registered }),
}))
