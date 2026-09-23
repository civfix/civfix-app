/**
 * THE EXIT FREEZE. Leaving Search fires TWO hard content remounts on the fade frames: `selectView` clears
 * `query` (nav/useNavStore.ts), so the results surface swaps to the resting one, and one frame later the
 * field's blur drops `searchBarStore.pinned`, swapping RecentlySearched to Discovery: three
 * react-query-backed sections plus a horizontal ScrollView of avatar cards and FollowButtons, mounting on
 * exactly the frames the overlay is fading and the glass is morphing.
 *
 * THE SHAPE is `bodyFadeStyle`'s freeze-while-closing (shell/CompactShell.native.tsx): write the
 * live value into a holding cell ONLY while not closing, and return the cell while closing. The cell here
 * carries the query as well as the surface, because holding "results" while the query is already "" would
 * still re-render SearchResults with different props, a content change on the fade frames all the same.
 *
 * IT IS A FREEZE, NOT A CROSSFADE. No second copy of the body is mounted (it cannot work on native, where
 * bodies register into gorhom's one shared active-scrollable registry) and no ScrollHost identity changes
 * (that would swap the ScrollView component TYPE and remount the whole subtree). Only WHICH children the
 * one resident body renders is held.
 *
 * THE FREEZE CONDITION IS DERIVED, NOT PUBLISHED. `isSearchBodyFrozen` reads the nav view, so it is true in
 * the SAME render that clears the query. A flag published from an effect commits one render later, by
 * which point the swap this exists to prevent has already happened.
 *
 * This changes WHICH content renders, never HOW IT IS LAID OUT, and it is gated on the dock morph, never
 * on a keyboard signal: gating this surface's layout on the keyboard was tried and rejected.
 */
import type { View } from "../nav"
import { getSearchBodyMode } from "./searchRecentStore"

export type SearchSurface = "results" | "recents" | "discovery"

/** Everything SearchBody needs to render one surface: the surface AND the query it was built for. */
export interface SearchSurfaceState {
  surface: SearchSurface
  query: string
}

/**
 * The LIVE surface for a navigation query + the docked bar's pinned state (Apple-Music model):
 * typing -> results, focused-with-no-query -> recents, resting -> discovery.
 *
 * The non-results surfaces carry an empty query: they take none, and a frozen resting surface must never
 * be able to resurrect a stale one.
 */
export function searchSurfaceState(query: string, pinned: boolean): SearchSurfaceState {
  const trimmed = query.trim()
  if (getSearchBodyMode(trimmed) === "results") return { surface: "results", query: trimmed }
  return { surface: pinned ? "recents" : "discovery", query: "" }
}

/**
 * THE FREEZE. `held` is the last state rendered while Search was live; `frozen` is true from the first
 * frame of an exit until the dock morph settles. Returns the SAME object it was handed, so a frozen render
 * changes no prop identity downstream.
 */
export function resolveSearchSurfaceState(
  live: SearchSurfaceState,
  held: SearchSurfaceState,
  frozen: boolean,
): SearchSurfaceState {
  return frozen ? held : live
}

/**
 * Is the search body riding a fade OUT right now?
 *
 * `view !== "search"` is derived (see the module header) so the freeze is live on the very frame the query
 * clears. `exitSettled` is published by the dock morph's exit timing once the overlay has finished fading
 * (searchBarStore.searchExitSettled). Releasing there, rather than at the next Search ENTER, keeps the
 * held surface's teardown off both the fade-out frames AND the enter spring's opening frames. It matters
 * that the release happens at all: SearchBodyReveal.native is MOUNT-ONCE (it keeps the search body
 * resident forever after the first open), so a freeze that never released would strand a stale surface.
 */
export function isSearchBodyFrozen(view: View, exitSettled: boolean): boolean {
  return view !== "search" && !exitSettled
}
