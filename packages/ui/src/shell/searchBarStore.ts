/**
 * Docked search-bar state published across the shell/body boundary, like `tabBarStore.tabBarHeight`: the
 * docked bar's focus state is private to SearchHeader, but SearchBody pads its content and fades its
 * resting title off it, and the rail's Search orb (shell chrome) must focus a field inside a body.
 *
 * Both platforms publish `pinned = focused || query`. Never persisted: a persisted `true` would strand the
 * padding on a later load, so the docked bar resets it on blur/unmount and zeroes the reserve on unmount.
 */
import { create } from "zustand"

export interface SearchBarState {
  pinned: boolean
  barHeight: number
  /**
   * Native only: `useKeyboardAnchor`'s `reserved` for the docked bar, which SearchBodyReveal.native folds
   * into the search list's scroll padding so the tail stays clear of the risen bar. Web must not publish
   * it: KeyboardAwareScroll.web already reserves the visual-viewport overlap, so a second reservation would
   * double-inset the web search surface.
   *
   * SearchBody must never read this or any keyboard signal: its layout is deliberately
   * keyboard-independent, and a keyboard-conditional layout can drop the spacer that clears the dock.
   */
  keyboardReserve: number
  /**
   * True once a Search exit's dock morph has settled. SearchBody freezes its content until then, so the
   * exit's two hard remounts land on an invisible overlay instead of on the fade frames. Re-armed to false
   * on every Search enter so the freeze is live on the first frame of the next exit. Web never publishes
   * it, which is inert there.
   */
  searchExitSettled: boolean
  /**
   * A one-shot landscape focus request: 0 means nothing pending. A number rather than a boolean because
   * the orb and the `/` key press from outside the search body, often before it exists: a request made
   * before mount is honoured on the first frame after it, and one made while the field is resident is a
   * value change its effect re-runs on. Deep links never set it, so `/search` opens unfocused.
   */
  focusNonce: number
  setPinned: (pinned: boolean) => void
  setBarHeight: (height: number) => void
  setKeyboardReserve: (reserve: number) => void
  setSearchExitSettled: (settled: boolean) => void
  requestSearchFocus: () => void
  /** Clears the request so no later Search entry inherits it. */
  consumeSearchFocus: () => void
}

/** Search pill 40 + 2x10 padding, used until the bar measures itself. */
const NOMINAL_BAR_HEIGHT = 60

export const useSearchBarStore = create<SearchBarState>((set) => ({
  pinned: false,
  barHeight: NOMINAL_BAR_HEIGHT,
  keyboardReserve: 0,
  searchExitSettled: false,
  focusNonce: 0,
  setPinned: (pinned) => set({ pinned }),
  setBarHeight: (height) => set({ barHeight: Math.max(0, Math.round(height)) }),
  setKeyboardReserve: (reserve) =>
    set({ keyboardReserve: Number.isFinite(reserve) ? Math.max(0, Math.round(reserve)) : 0 }),
  setSearchExitSettled: (settled) => set({ searchExitSettled: settled }),
  // Increment rather than set-to-1: presses before mount coalesce into one consume, while a press after
  // a consume still moves the value off 0 so the field's effect re-runs.
  requestSearchFocus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  consumeSearchFocus: () => set({ focusNonce: 0 }),
}))
