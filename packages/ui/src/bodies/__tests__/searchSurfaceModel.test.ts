/**
 * Modelled on `bodyFadeStyle`'s freeze-while-closing (shell/CompactShell.native.tsx): the live
 * value is written into a holding cell only while NOT closing, and the closing branch returns the cell.
 * Here the cell is the SURFACE plus the query it was built for, because `selectView` clears the query in
 * the same store update that changes the view; holding the surface without the query would re-render
 * SearchResults with an empty query, which is a content change on the fade frames all the same.
 */
import { describe, expect, it } from "vitest"
import {
  isSearchBodyFrozen,
  resolveSearchSurfaceState,
  searchSurfaceState,
  type SearchSurfaceState,
} from "../searchSurfaceModel"

describe("searchSurfaceState", () => {
  it("is results for a typed query, carrying the trimmed query", () => {
    expect(searchSurfaceState("  Echo Park  ", false)).toEqual({ surface: "results", query: "Echo Park" })
  })
  it("is results even while the bar is pinned: typing wins over focus", () => {
    expect(searchSurfaceState("Echo Park", true)).toEqual({ surface: "results", query: "Echo Park" })
  })
  it("is recents when the docked bar is pinned with no query", () => {
    expect(searchSurfaceState("   ", true)).toEqual({ surface: "recents", query: "" })
  })
  it("is discovery at rest", () => {
    expect(searchSurfaceState("", false)).toEqual({ surface: "discovery", query: "" })
  })
})

describe("resolveSearchSurfaceState: freeze-while-exiting", () => {
  const RESULTS: SearchSurfaceState = { surface: "results", query: "echo park" }
  // What SearchBody computes on the FIRST frame of an exit: selectView cleared the query in the same
  // store update that changed the view, and the blur drops `pinned` a frame later.
  const AFTER_EXIT: SearchSurfaceState = { surface: "discovery", query: "" }

  it("renders live content while Search is live", () => {
    expect(resolveSearchSurfaceState(RESULTS, AFTER_EXIT, false)).toBe(RESULTS)
  })
  it("holds the surface AND its query through the exit, so ZERO remounts land on the fade frames", () => {
    expect(resolveSearchSurfaceState(AFTER_EXIT, RESULTS, true)).toBe(RESULTS)
  })
  it("returns to live content once the exit has settled", () => {
    expect(resolveSearchSurfaceState(AFTER_EXIT, RESULTS, false)).toBe(AFTER_EXIT)
  })
  it("also holds the recents -> discovery swap, not just results -> resting", () => {
    const RECENTS: SearchSurfaceState = { surface: "recents", query: "" }
    expect(resolveSearchSurfaceState(AFTER_EXIT, RECENTS, true)).toBe(RECENTS)
  })
})

describe("isSearchBodyFrozen", () => {
  it("freezes from the FIRST frame of an exit", () => {
    // Derived from the nav view, so it is true in the SAME render selectView clears the query in. A flag
    // published from an effect would arrive one commit late and the swap would already have happened.
    expect(isSearchBodyFrozen("home", false)).toBe(true)
    expect(isSearchBodyFrozen("map", false)).toBe(true)
  })
  it("never freezes while Search is the current view", () => {
    expect(isSearchBodyFrozen("search", false)).toBe(false)
    expect(isSearchBodyFrozen("search", true)).toBe(false)
  })
  it("releases once the dock morph has settled, so the remount lands on a quiet, invisible overlay", () => {
    expect(isSearchBodyFrozen("home", true)).toBe(false)
  })
})
