/**
 * The docked search-bar pinned-state store (zustand) - liquid-glass redesign, Task 3.
 *
 * When the bottom-docked search bar is PINNED to the top (its field focused, or a query is set) it rises
 * out of the dock and sits below the safe-area top edge - directly over where the resting Search page's
 * large "Search" title lives. The title has no way to know the bar has risen (the focus state is private
 * to SearchHeader.native's DockedSearchBar), so this store publishes it across the shell/body boundary,
 * exactly like `tabBarStore.tabBarHeight`: the docked bar SETS `pinned` from its focus/blur transitions
 * and SearchBody READS it to (a) pad its scroll content down by the pinned bar's height so nothing hides
 * under the bar, and (b) fade the resting title out of the way.
 *
 * BOTH PLATFORMS PIN (corrected): `SearchHeader.web.tsx`'s DockedSearchBar publishes the SAME
 * `pinned = focused || query` as the native seam, so the discovery <-> recently-searched swap happens on
 * web too. The stale claim that "web is never pinned" was written when only the native bar had the
 * pin-to-top travel; that travel is gone and the flag is now purely a CONTENT signal.
 *
 * `keyboardReserve` IS NATIVE-ONLY, and deliberately so. `SearchHeader.web` must NOT publish it:
 * `KeyboardAwareScroll.web` already reserves the visual-viewport overlap on the base scroller, so a second
 * reservation here would double-inset the web search surface. Web consumers that need the same signal read
 * `useKeyboardInset()` directly. The field therefore stays 0 on web, which makes every native-only consumer
 * a no-op there rather than a special case.
 *
 * IT ALSO CARRIES THE LANDSCAPE FOCUS REQUEST (`focusNonce`). Same reason the pinned flag is here: the
 * rail's Search orb is SHELL chrome and the field it must focus is inside a BODY, so the request crosses
 * the same boundary in the same direction. It is a one-shot the field consumes, not a mode - see the
 * field's doc below.
 *
 * EPHEMERAL (never persisted): pinning is live focus state; a persisted `true` would strand the padding
 * on a later load. The docked bar resets it to false on unmount / blur, and zeroes the reserve on unmount.
 *
 * Pure zustand: no next / expo / react-native, so it unit-tests directly under vitest.
 */
import { create } from "zustand"

export interface SearchBarState {
  /**
   * True while the docked search bar is pinned to the top (native focus/query state). SearchBody reads
   * this to add top clearance + fade the "Search" title. False on web and whenever the bar rests in dock.
   */
  pinned: boolean
  /**
   * The docked bar's measured height (pt) - the top clearance SearchBody applies when `pinned`. Defaults
   * to the nominal bar height until the docked bar measures itself; floored at 0.
   */
  barHeight: number
  /**
   * NATIVE ONLY. The bottom space (pt) the docked bar's keyboard rise has taken out of the surface below
   * it — `useKeyboardAnchor`'s `reserved`, i.e. the lift that puts the pill 8pt above the keyboard top.
   * Its ONLY consumer is `SearchBodyReveal.native`, which folds it into the search list's dock-clearance
   * scroll padding so the tail stays scrollable clear of the risen bar. PER-TRANSITION, never per-frame: it
   * steps once at will-show and is held until did-settle. Stays 0 on web (see the file header) — every
   * consumer is a no-op there.
   *
   * `SearchBody` must NEVER gate layout on this (or on any keyboard signal) — commit a637875 bottom-
   * anchored the recents list on `keyboardReserve > 0` and was reverted at the user's explicit request;
   * see THE RULE in `bodies/SearchBody.tsx`'s `SearchResting`. `SearchBody` does not read this field.
   */
  keyboardReserve: number
  /**
   * NATIVE-DRIVEN. True once a Search EXIT's dock morph has SETTLED at rest — i.e. the search overlay has
   * finished fading out. `SearchBody` reads it together with the nav view
   * (`isSearchBodyFrozen(view, searchExitSettled)`) to decide whether to render FROZEN content, so the two
   * hard remounts of the exit (SearchResults -> SearchResting, RecentlySearched -> Discovery) land on a
   * quiet, invisible overlay instead of on the fade frames.
   *
   * It starts FALSE and is re-armed to false on every Search ENTER, so the freeze is live on the first
   * frame of the next exit — the frame `selectView` clears the query in.
   *
   * The web seam publishes nothing, which is inert: `isSearchBodyFrozen` is false whenever the view IS
   * search, and on web SearchBody only exists while it is (or briefly, as the outgoing body of its own
   * BodyTransition, where the same freeze is a bonus).
   */
  searchExitSettled: boolean
  /**
   * LANDSCAPE FOCUS REQUEST (design §3.5). A one-shot signal, not a mode: 0 means "nothing pending", any
   * other value means "the search field should take focus as soon as it can".
   *
   * WHY A NUMBER AND NOT A BOOLEAN: the rail's Search orb and the `/` key both press from OUTSIDE the
   * search body - often before that body exists at all, since the same press is what navigates to it. The
   * field reads this in an effect and calls `consumeSearchFocus()`, so a request made before the mount is
   * still honoured on the first frame after it, and a request made while the field is already resident is
   * a value CHANGE the effect re-runs on. A boolean set true and read once cannot do the second.
   *
   * DEEP LINKS NEVER SET IT (D10): `/search` opens with the field present but unfocused, so this stays 0
   * and the effect never fires. Only a deliberate Search PRESS arms it, and only when that press actually
   * lands on Search (`searchPressOpensSearch` - the re-tap rule would otherwise strand a request here).
   */
  focusNonce: number
  /** Publish the pinned state (docked bar focus/blur transitions; both seams). */
  setPinned: (pinned: boolean) => void
  /** Publish the docked bar's measured height (rounded, floored at 0). */
  setBarHeight: (height: number) => void
  /** Publish the keyboard reserve (rounded, floored at 0). NATIVE docked bar only. */
  setKeyboardReserve: (reserve: number) => void
  /** Publish the search exit's settle. NATIVE dock morph only (TabBar.native's dockMorphOut timing). */
  setSearchExitSettled: (settled: boolean) => void
  /** Ask the landscape search field to take focus (rail orb / `/` key). See `focusNonce`. */
  requestSearchFocus: () => void
  /** The field acknowledging the request. Clears it so no LATER Search entry inherits this one. */
  consumeSearchFocus: () => void
}

/** Nominal docked-bar height used until the bar measures itself (search pill 40 + 2x10 padding). */
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
  // Increment rather than set-to-1: two presses that both land before the field mounts coalesce (one
  // consume clears them), while a press AFTER a consume still moves the value off 0 so the field's effect
  // re-runs. See the `focusNonce` doc above.
  requestSearchFocus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  consumeSearchFocus: () => set({ focusNonce: 0 }),
}))
