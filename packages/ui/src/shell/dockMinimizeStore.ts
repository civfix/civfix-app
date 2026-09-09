/**
 * dockMinimizeStore - the bottom TabBar's SCROLL-MINIMIZE decision (round 3; Apple-Music `.onScrollDown`).
 *
 * A scrollable body (Home feed, Messages list, any ScrollHost consumer) reports its scroll offset here
 * through `handleScroll`; the pure `reduceMinimize` hysteresis (minimizeScrollLogic) decides whether the
 * tab pill should collapse into its glyph circle. The reactive `minimized` boolean is the single source of
 * truth the TabBar.native reads (to spring its `mz` progress + gate tab hit-targets). This mirrors the
 * tabBarStore pattern: a pure zustand store (NO reanimated / RN), so it unit-tests directly and stays safe
 * for any bundle - though only the native shell mounts the scroll wrapper + the native TabBar consume it.
 *
 * The scroll-tracking state (lastY / accumulator / primed) is a MODULE singleton, not React state: there is
 * only ever ONE bottom dock, and threading a mutable tracker through zustand's immutable set() would force a
 * store write on every scroll frame (the minimized boolean already only writes on an actual toggle). On a
 * manual restore (tapping the collapsed circle) or a navigation reset the tracker is re-seeded so a fresh
 * threshold of downward travel is required before it can re-collapse - a stray momentum frame won't undo the
 * user's restore.
 */
import { create } from "zustand"
import { initialMinimizeState, reduceMinimize, type MinimizeState } from "./minimizeScrollLogic"

/** Singleton scroll tracker (see file header: one dock, per-frame updates must not hit the store). */
let tracker: MinimizeState = initialMinimizeState()

export interface DockMinimizeState {
  /** True = collapsed glyph circle (Apple-Music minimized bar); false = full tab pill. */
  minimized: boolean
  /**
   * Fold a scroll offset into the minimize decision. `suppressed` (true during Search, where the dock is
   * the search field, not the tab pill) tracks the offset but never toggles - so search-result scrolling
   * never collapses anything, and leaving Search resumes from the current offset.
   */
  handleScroll: (y: number, suppressed?: boolean) => void
  /**
   * Force the full pill and RE-SEED the tracker (tapping the collapsed circle, or a body mount/unmount on
   * navigation). A fresh threshold of downward travel is then needed before it can minimize again.
   */
  reset: () => void
}

export const useDockMinimizeStore = create<DockMinimizeState>((set, get) => ({
  minimized: false,
  handleScroll: (y, suppressed = false) => {
    if (suppressed) {
      // Keep lastY current (clamped) but make no decision while the dock is the search field. The
      // directional accumulator is CLEARED as well: it was built from pre-suppression travel, so
      // carrying it across the suppressed stretch would let leaving Search resume with a stale
      // direction and toggle off a single unrelated frame. Re-seeding it means a fresh threshold of
      // travel is needed after Search, exactly like `reset`.
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
