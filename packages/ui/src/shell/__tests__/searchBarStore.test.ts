/**
 * `keyboardReserve` is the same number that lifts the bar, read by one consumer (SearchBodyReveal's
 * scroll padding), so there is no second derivation and its normalisation (round, floor at 0, reject
 * non-finite) is pinned here.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useSearchBarStore } from "../searchBarStore"

function reset(): void {
  useSearchBarStore.setState({
    pinned: false,
    barHeight: 60,
    keyboardReserve: 0,
    searchExitSettled: false,
    focusNonce: 0,
  })
}

beforeEach(reset)

describe("searchBarStore", () => {
  it("defaults the keyboard reserve to 0 (web never publishes one)", () => {
    expect(useSearchBarStore.getState().keyboardReserve).toBe(0)
  })

  it("rounds the published reserve and floors it at 0", () => {
    const set = useSearchBarStore.getState().setKeyboardReserve
    set(316.6)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(317)
    set(-12)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(0)
  })

  it("treats a non-finite reserve as zero rather than poisoning the layout", () => {
    const set = useSearchBarStore.getState().setKeyboardReserve
    set(Number.NaN)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(0)
    set(Number.POSITIVE_INFINITY)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(0)
  })

  it("keeps the reserve independent of the pinned flag", () => {
    // `pinned` is focus-derived and true on a desktop hardware keyboard too; the reserve is what proves a
    // SOFT keyboard is actually up, and it is published/cleared by the anchor alone. Keeping the two
    // independent is what lets the overlay layer reserve space for a risen bar without inferring it from
    // focus (and vice versa: a focused bar with no soft keyboard reserves nothing).
    useSearchBarStore.getState().setPinned(true)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(0)
    useSearchBarStore.getState().setKeyboardReserve(317)
    useSearchBarStore.getState().setPinned(false)
    expect(useSearchBarStore.getState().keyboardReserve).toBe(317)
  })

  it("declares searchExitSettled FALSE in the store's OWN initial state", () => {
    // `getInitialState()`, not `getState()`: zustand's `setState` merges, so the `reset()` helper would
    // inject the field and this assertion would pass against a store that never declared it.
    expect(useSearchBarStore.getInitialState().searchExitSettled).toBe(false)
  })

  it("publishes the exit settle and re-arms it on the next enter", () => {
    useSearchBarStore.getState().setSearchExitSettled(true)
    expect(useSearchBarStore.getState().searchExitSettled).toBe(true)
    useSearchBarStore.getState().setSearchExitSettled(false)
    expect(useSearchBarStore.getState().searchExitSettled).toBe(false)
  })
})

/**
 * The rail's Search orb and the `/` key must focus a field in a body that may not be mounted yet; a
 * number the field consumes and zeroes makes that a one-shot rather than a mode.
 */
describe("searchBarStore focus request", () => {
  it("starts at 0 in the store's OWN initial state - a deep link must never auto-focus", () => {
    // getInitialState(), for the same reason as the searchExitSettled assertion.
    expect(useSearchBarStore.getInitialState().focusNonce).toBe(0)
  })

  it("arms a request the field can see as a CHANGE, and clears it once consumed", () => {
    useSearchBarStore.getState().requestSearchFocus()
    expect(useSearchBarStore.getState().focusNonce).toBeGreaterThan(0)
    useSearchBarStore.getState().consumeSearchFocus()
    expect(useSearchBarStore.getState().focusNonce).toBe(0)
  })

  it("re-arms after a consume, so a SECOND orb press focuses again", () => {
    // The field is already mounted and consumed the first request; the second press must still produce a
    // 0 -> non-0 transition or the effect that watches it never re-runs.
    useSearchBarStore.getState().requestSearchFocus()
    useSearchBarStore.getState().consumeSearchFocus()
    useSearchBarStore.getState().requestSearchFocus()
    expect(useSearchBarStore.getState().focusNonce).toBeGreaterThan(0)
  })

  it("coalesces repeat requests, and ONE consume clears them all", () => {
    // Two presses before the field mounts must not leave a request behind for the next Search entry.
    useSearchBarStore.getState().requestSearchFocus()
    useSearchBarStore.getState().requestSearchFocus()
    useSearchBarStore.getState().consumeSearchFocus()
    expect(useSearchBarStore.getState().focusNonce).toBe(0)
  })

  it("keeps the request independent of the pinned flag", () => {
    // `pinned` is live focus STATE (which surface renders); the nonce is a one-shot REQUEST. A field that
    // is already focused can still be asked to focus again, and pinning must not arm anything.
    useSearchBarStore.getState().setPinned(true)
    expect(useSearchBarStore.getState().focusNonce).toBe(0)
    useSearchBarStore.getState().requestSearchFocus()
    useSearchBarStore.getState().setPinned(false)
    expect(useSearchBarStore.getState().focusNonce).toBeGreaterThan(0)
  })
})
