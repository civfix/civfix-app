/**
 * The dock's scroll-minimize decision (iOS 26 `tabBarMinimizeBehavior(.onScrollDown)`): scroll bodies
 * report offsets through `handleScroll`, the pure `reduceMinimize` hysteresis decides, and TabBar.native
 * reads `minimized`. Pure zustand, so it unit-tests directly and is safe in any bundle.
 *
 * The scroll tracker is a module singleton, not store state: there is only ever one dock, and threading a
 * mutable tracker through zustand's immutable set() would write the store on every scroll frame. A manual
 * restore or navigation reset re-seeds it, so a stray momentum frame cannot undo the user's restore.
 */
import { create } from "zustand"
import { initialMinimizeState, reduceMinimize, type MinimizeState } from "./minimizeScrollLogic"

let tracker: MinimizeState = initialMinimizeState()

export interface DockMinimizeState {
  /** True = collapsed glyph circle, false = full tab pill. */
  minimized: boolean
  /** `suppressed` (during Search, where the dock is the search field) tracks the offset but never toggles. */
  handleScroll: (y: number, suppressed?: boolean) => void
  reset: () => void
}

export const useDockMinimizeStore = create<DockMinimizeState>((set, get) => ({
  minimized: false,
  handleScroll: (y, suppressed = false) => {
    if (suppressed) {
      // The accumulator is cleared too: carried across the suppressed stretch, its stale direction would
      // let leaving Search toggle off a single unrelated frame.
      tracker = { ...tracker, lastY: y < 0 ? 0 : y, accum: 0, primed: true }
      return
    }
    tracker = reduceMinimize(tracker, y)
    if (tracker.minimized !== get().minimized) set({ minimized: tracker.minimized })
  },
  reset: () => {
    tracker = initialMinimizeState()
    if (get().minimized) set({ minimized: false })
  },
}))
