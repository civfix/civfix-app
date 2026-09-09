/**
 * dockMinimizeStore - the stateful wrapper around the pure `reduceMinimize` hysteresis.
 *
 * The reducer itself is covered by minimizeScrollLogic.test.ts; what is exercised here is the store's own
 * behaviour: the singleton tracker it threads between frames, the `reset` re-seed, and the SUPPRESSED path
 * (Search, where the dock is the search field) - which must track the offset without toggling AND without
 * carrying its directional accumulator across the suppressed stretch.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useDockMinimizeStore } from "../dockMinimizeStore"
import { MINIMIZE_THRESHOLD } from "../minimizeScrollLogic"

/** Fold a sequence of offsets through the store (all unsuppressed unless stated). */
function feed(ys: number[], suppressed = false): void {
  for (const y of ys) useDockMinimizeStore.getState().handleScroll(y, suppressed)
}

beforeEach(() => useDockMinimizeStore.getState().reset())

describe("dockMinimizeStore", () => {
  it("minimizes once a threshold of downward travel accumulates, and restores on the way back up", () => {
    feed([100, 100 + MINIMIZE_THRESHOLD + 6])
    expect(useDockMinimizeStore.getState().minimized).toBe(true)
    feed([100])
    expect(useDockMinimizeStore.getState().minimized).toBe(false)
  })

  it("reset() forces the full pill AND re-seeds, so a fresh threshold of travel is needed to re-minimize", () => {
    feed([100, 100 + MINIMIZE_THRESHOLD + 6])
    expect(useDockMinimizeStore.getState().minimized).toBe(true)

    useDockMinimizeStore.getState().reset()
    expect(useDockMinimizeStore.getState().minimized).toBe(false)

    // A single stray momentum frame at the previously-minimizing offset must NOT re-collapse it: after the
    // re-seed the first sample only primes lastY.
    feed([100 + MINIMIZE_THRESHOLD + 6])
    expect(useDockMinimizeStore.getState().minimized).toBe(false)
  })

  it("suppressed frames track the offset but never toggle", () => {
    feed([100])
    feed([100 + MINIMIZE_THRESHOLD * 4], true)
    expect(useDockMinimizeStore.getState().minimized).toBe(false)
  })

  it("suppression CLEARS the accumulator, so leaving Search never resumes on stale directional travel", () => {
    // Half a threshold of downward travel before Search opens...
    const half = Math.floor(MINIMIZE_THRESHOLD / 2)
    feed([100, 100 + half])
    expect(useDockMinimizeStore.getState().minimized).toBe(false)

    // ...a suppressed frame while the dock is the search field...
    feed([100 + half * 2], true)

    // ...then the SAME half-threshold of travel after leaving. On its own that is below the threshold, so
    // the pill must stay full; if the pre-Search accumulator had been carried over it would sum past it.
    feed([100 + half * 3])
    expect(useDockMinimizeStore.getState().minimized).toBe(false)
  })
})
