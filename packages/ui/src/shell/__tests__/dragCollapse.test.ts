/**
 * Unit test for the compact sheet's drag-to-collapse gating (CompactShell.native): dragging a DETAIL down
 * to peek must revert it to its PARENT list, swapping the header DetailBar back to the search bar. Like the
 * other shell tests, this drives PURE source predicates over the live nav store - the package ships no RN
 * renderer, so we replay gorhom's onAnimate/onChange callback sequence through a tiny harness wired exactly
 * the way CompactShell.native wires them, and assert the store reverted.
 *
 * THE BUG (regression guard): if the user expands from peek and, BEFORE that up-animation settles, drags
 * back down to peek, the up-move never settled - so gorhom's `from` index (onAnimate) AND the previously-
 * settled index (onChange) are BOTH still 0. Gating the revert on "came DOWN from a taller snap"
 * (from > 0 / prev !== 0) therefore MISSES, stranding the detail at peek showing its DetailBar instead of
 * the parent SearchHeader. The fix gates on the DESTINATION (heading to / resting at peek) instead.
 *
 * THE SAME CALLBACK SEQUENCE NOW ALSO ARISES FROM A CONTENT PULL-DOWN. Since the sheet-handoff decorator
 * landed (SheetHandoffScroll.native, injected innermost in CompactShell.native's SHEET_SCROLL_HOST), a
 * downward drag at the top of a sheet body's content drives `animateToPosition` directly — so gorhom emits
 * exactly these onAnimate/onChange callbacks with no grab-handle touch involved. Everything below therefore
 * covers both drag sources. The handoff additionally settles the store EXPLICITLY, because gorhom's
 * `animateToPosition` early-returns on `position === animatedPosition.get()` BEFORE emitting anything; the
 * last case pins that path.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { armCollapse, shouldCollapseOnSettle, COLLAPSE_SWAP_AT } from "../dragCollapse"
import { useNavStore, type Snap } from "../../nav"

/**
 * Reset the singleton store to a clean home/peek state in the COMPACT layout (so push replaces).
 *
 * `originView` is part of the reset because a collapse now dismisses to the view the pull-up was opened
 * FROM, and this is a RAW setState (no reducer runs) - a leftover origin would leak across tests. Each
 * case below therefore establishes its origin EXPLICITLY with `selectView(...)` before opening a detail,
 * which is also what makes the destination assertions meaningful.
 */
function resetCompact(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "compact",
    originView: null,
  })
}

/**
 * Replays gorhom's callbacks the way CompactShell.native wires them, using the SOURCE gating predicates and
 * the REAL store collapseToParent. Mirrors the shell's two pieces of state: the armed flag (the
 * `collapseCommitted` shared value) and the last-settled index (`currentIndexRef`).
 */
function makeSheetHarness() {
  let committed = false // mirrors the `collapseCommitted` shared value
  let lastSettled = 0 // mirrors `currentIndexRef.current`
  const collapse = () => useNavStore.getState().collapseToParent()
  return {
    /** gorhom onAnimate(from, to): commit. */
    commit(fromIndex: number, toIndex: number) {
      committed = armCollapse(fromIndex, toIndex)
    },
    /** reanimated reaction: the animated index moved to `idx` (0=peek..2=full). */
    moveTo(idx: number) {
      if (committed && idx <= COLLAPSE_SWAP_AT) {
        committed = false
        collapse()
      }
    },
    /** gorhom onChange(index): settle. */
    settle(index: number) {
      const prevIndex = lastSettled
      lastSettled = index
      if (shouldCollapseOnSettle(index, prevIndex)) collapse()
    },
  }
}

beforeEach(resetCompact)

describe("CompactShell drag-to-collapse gating", () => {
  it("reverts to the ORIGIN view after an interrupted pull-up then a quick pull-down to peek", () => {
    // Open a report detail FROM THE MAP TAB (a pin tap); sheet peek -> mid.
    useNavStore.getState().selectView("map")
    useNavStore.getState().push({ kind: "pin", id: "r1" })
    const h = makeSheetHarness()

    // Flick UP from peek; gorhom commits 0 -> 1 but the animation is INTERRUPTED before it settles
    // (no settle(1) ever fires), so the from-index stays 0.
    h.commit(0, 1)
    h.moveTo(0.3)
    // Immediately pull back DOWN to peek; gorhom's from-index is STILL 0 (never settled at 1).
    h.commit(0, 0)
    h.moveTo(0)
    h.settle(0)

    const s = useNavStore.getState()
    expect(s.active).toBeNull() // detail reverted - header is the search bar again
    // THE REPORTED BUG, through the drag path: this used to land on the (usually empty) Reports list,
    // because the destination came from the static kind->view map (pin -> reports) instead of from where
    // the user actually was. Dismissing the only exit gesture must return to the map.
    expect(s.view).toBe("map")
  })

  it("still reverts on a normal mid -> peek collapse (smooth path intact)", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "cleanup", id: "c1" }) // peek -> mid
    const h = makeSheetHarness()

    h.commit(1, 0) // drag down, commit mid -> peek
    h.moveTo(0.6) // drops past COLLAPSE_SWAP_AT -> the armed swap fires mid-motion

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("events") // opened FROM the events list, so it returns there
  })

  it("does NOT revert while merely expanding peek -> mid (never reaches peek)", () => {
    useNavStore.getState().push({ kind: "person", id: "p1" })
    const h = makeSheetHarness()

    h.commit(0, 1) // open higher
    h.moveTo(1) // rises to mid; never returns to peek
    h.settle(1)

    expect(useNavStore.getState().active).toEqual({ kind: "person", id: "p1" }) // still open
  })

  it("does NOT revert on a full -> mid collapse that stops above peek", () => {
    useNavStore.setState({ snap: 2 })
    useNavStore.getState().push({ kind: "pin", id: "r2" })
    const h = makeSheetHarness()

    h.commit(2, 1) // full -> mid, not peek
    h.moveTo(1)
    h.settle(1)

    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r2" }) // still open
  })
})

/**
 * The CONTENT pull-down path (sheet handoff). The gesture is native-only and this package ships no RN
 * renderer, so the store contract is driven directly and the wiring that reaches it is pinned by source
 * text — the same split every other shell test in this folder uses.
 */
describe("sheet handoff collapse", () => {
  /**
   * `settleToSnap` as SheetHandoffScroll.native defines it: index 0 with a detail open collapses to the
   * parent; anything else is a plain snap. Mirrored here (the seam's copy is module-private and importing
   * the file would drag reanimated + gorhom into vitest); the source guard below keeps the two in step.
   */
  function settleToSnap(index: number): void {
    const nav = useNavStore.getState()
    if (index === 0 && nav.active !== null) nav.collapseToParent()
    else nav.setSnap(index as Snap)
  }

  it("reverts a settled mid detail to its origin when the content is pulled down to peek", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().push({ kind: "pin", id: "r3" }) // peek -> mid
    const h = makeSheetHarness()
    h.settle(1) // the sheet is fully settled at mid before the finger touches the content

    h.commit(1, 0) // the handoff hands gorhom a peek destination
    h.moveTo(0.5) // ...and the armed swap fires as it drops past COLLAPSE_SWAP_AT
    h.settle(0)

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("map")
  })

  it("reaches the same store state from the EXPLICIT settle alone, with no gorhom callback at all", () => {
    // THE REGRESSION GUARD for gorhom's exact-equality early-return: `animateToPosition` returns before
    // `handleOnAnimate` / `handleOnChange` whenever the requested position already equals the live one, so
    // a handoff that landed on the detent would emit NOTHING and strand the sheet at peek with the store
    // still on the old snap. The handoff therefore never depends on those callbacks to settle.
    useNavStore.getState().selectView("map")
    useNavStore.getState().push({ kind: "pin", id: "r4" })
    settleToSnap(0)

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("map")
  })

  it("treats a non-zero destination as an ordinary snap, never a collapse", () => {
    useNavStore.getState().push({ kind: "cleanup", id: "c2" })
    settleToSnap(2)

    const s = useNavStore.getState()
    expect(s.active).toEqual({ kind: "cleanup", id: "c2" })
    expect(s.snap).toBe(2)
  })

  it("keeps the mirrored settle in step with the seam's own", () => {
    const seam = readFileSync(new URL("../SheetHandoffScroll.native.tsx", import.meta.url), "utf8")
    expect(seam).toMatch(/if \(index === 0 && nav\.active !== null\) nav\.collapseToParent\(\)/)
    expect(seam).toMatch(/else nav\.setSnap\(index as Snap\)/)
  })
})
