/**
 * The package ships no RN renderer, so this replays gorhom's onAnimate/onChange sequence through a harness
 * wired the way CompactShell.native wires it and asserts on the live nav store. The same sequence arises
 * from a grab-handle drag and from a content pull-down (SheetHandoffScroll.native).
 *
 * Regression guard: after an interrupted pull-up then a quick pull-down, both gorhom's `from` index and the
 * last settled index are still 0, so gating the revert on "came down from a taller snap" strands the
 * detail at peek.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { armCollapse, shouldCollapseOnSettle, COLLAPSE_SWAP_AT } from "../dragCollapse"
import { useNavStore, type Snap } from "../../nav"

/**
 * `originView` is reset because this raw setState runs no reducer and a leftover origin would leak across
 * tests; each case sets its origin explicitly with `selectView(...)`.
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

function makeSheetHarness() {
  let committed = false // mirrors the `collapseCommitted` shared value
  let lastSettled = 0 // mirrors `currentIndexRef.current`
  const collapse = () => useNavStore.getState().collapseToParent()
  return {
    commit(fromIndex: number, toIndex: number) {
      committed = armCollapse(fromIndex, toIndex)
    },
    moveTo(idx: number) {
      if (committed && idx <= COLLAPSE_SWAP_AT) {
        committed = false
        collapse()
      }
    },
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
    useNavStore.getState().selectView("map")
    useNavStore.getState().push({ kind: "pin", id: "r1" })
    const h = makeSheetHarness()

    // The pull-up is interrupted before it settles, so the from-index stays 0.
    h.commit(0, 1)
    h.moveTo(0.3)
    h.commit(0, 0)
    h.moveTo(0)
    h.settle(0)

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    // The destination is where the user was, not the static kind-to-view map (pin -> reports).
    expect(s.view).toBe("map")
  })

  it("still reverts on a normal mid -> peek collapse (smooth path intact)", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "cleanup", id: "c1" })
    const h = makeSheetHarness()

    h.commit(1, 0)
    h.moveTo(0.6)

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("events")
  })

  it("does NOT revert while merely expanding peek -> mid (never reaches peek)", () => {
    useNavStore.getState().push({ kind: "person", id: "p1" })
    const h = makeSheetHarness()

    h.commit(0, 1)
    h.moveTo(1)
    h.settle(1)

    expect(useNavStore.getState().active).toEqual({ kind: "person", id: "p1" })
  })

  it("does NOT revert on a full -> mid collapse that stops above peek", () => {
    useNavStore.setState({ snap: 2 })
    useNavStore.getState().push({ kind: "pin", id: "r2" })
    const h = makeSheetHarness()

    h.commit(2, 1)
    h.moveTo(1)
    h.settle(1)

    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r2" })
  })
})

/**
 * The content pull-down gesture is native-only, so the store contract is driven directly and the wiring
 * that reaches it is pinned by source text.
 */
describe("sheet handoff collapse", () => {
  /**
   * A copy of SheetHandoffScroll.native's module-private `settleToSnap`: importing the seam would drag
   * reanimated and gorhom into vitest. The source guard below keeps the two in step.
   */
  function settleToSnap(index: number): void {
    const nav = useNavStore.getState()
    if (index === 0 && nav.active !== null) nav.collapseToParent()
    else nav.setSnap(index as Snap)
  }

  it("reverts a settled mid detail to its origin when the content is pulled down to peek", () => {
    useNavStore.getState().selectView("map")
    useNavStore.getState().push({ kind: "pin", id: "r3" })
    const h = makeSheetHarness()
    h.settle(1)

    h.commit(1, 0)
    h.moveTo(0.5)
    h.settle(0)

    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(s.view).toBe("map")
  })

  it("reaches the same store state from the EXPLICIT settle alone, with no gorhom callback at all", () => {
    // gorhom's animateToPosition emits no callback when the target equals the live position, so the
    // handoff must settle the store without them.
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
