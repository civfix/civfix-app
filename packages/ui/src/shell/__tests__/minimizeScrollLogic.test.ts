/** Momentum flings and the rubber-band settle must never chatter the bar. */
import { describe, it, expect } from "vitest"
import {
  initialMinimizeState,
  reduceMinimize,
  MINIMIZE_THRESHOLD,
  MINIMIZE_MIN_OFFSET,
  type MinimizeState,
} from "../minimizeScrollLogic"

/** Fold a sequence of scroll offsets through the reducer from a starting state. */
function feed(start: MinimizeState, ys: number[]): MinimizeState {
  return ys.reduce((s, y) => reduceMinimize(s, y), start)
}

describe("initialMinimizeState", () => {
  it("starts full (not minimized), zeroed and unprimed", () => {
    expect(initialMinimizeState()).toEqual({ lastY: 0, accum: 0, minimized: false, primed: false })
  })
})

describe("reduceMinimize priming + top band", () => {
  it("the first real sample only SEEDS lastY (never a phantom down-scroll from the mount-time 0)", () => {
    const s = reduceMinimize(initialMinimizeState(), 500)
    expect(s.minimized).toBe(false)
    expect(s.lastY).toBe(500)
    expect(s.primed).toBe(true)
    expect(s.accum).toBe(0)
  })

  it("at/above the top band (y <= MIN_OFFSET) the bar is ALWAYS restored, accumulator cleared", () => {
    const minimized: MinimizeState = { lastY: 300, accum: MINIMIZE_THRESHOLD, minimized: true, primed: true }
    const s = reduceMinimize(minimized, MINIMIZE_MIN_OFFSET) // exactly at the floor
    expect(s.minimized).toBe(false)
    expect(s.accum).toBe(0)
    expect(s.lastY).toBe(MINIMIZE_MIN_OFFSET)
  })

  it("only minimizes once scrolled PAST the top band + a threshold of travel", () => {
    // From the very top, scroll down through the band then past it: no collapse inside the band.
    const inBand = feed(initialMinimizeState(), [0, 8]) // both <= MIN_OFFSET(12)
    expect(inBand.minimized).toBe(false)
    // Now past the band, accumulate a full threshold of downward travel.
    const collapsed = feed(inBand, [20, 30, 40])
    expect(collapsed.minimized).toBe(true)
  })
})

describe("reduceMinimize down-scroll collapses after ~threshold of travel", () => {
  const primed: MinimizeState = { lastY: 100, accum: 0, minimized: false, primed: true }

  it("does NOT collapse on a sub-threshold down-scroll", () => {
    const s = reduceMinimize(primed, 100 + (MINIMIZE_THRESHOLD - 2))
    expect(s.minimized).toBe(false)
    expect(s.accum).toBeCloseTo(MINIMIZE_THRESHOLD - 2)
  })

  it("collapses once cumulative down travel reaches the threshold", () => {
    const s = feed(primed, [104, 108, 112, 116]) // +4 each = +16 > 14
    expect(s.minimized).toBe(true)
  })

  it("a single down jump past the threshold collapses immediately", () => {
    const s = reduceMinimize(primed, 100 + MINIMIZE_THRESHOLD + 6)
    expect(s.minimized).toBe(true)
    // Accumulator is clamped to the threshold (no unbounded backlog to unwind on reversal).
    expect(s.accum).toBe(MINIMIZE_THRESHOLD)
  })
})

describe("reduceMinimize up-scroll restores (hysteresis)", () => {
  const minimized: MinimizeState = { lastY: 300, accum: MINIMIZE_THRESHOLD, minimized: true, primed: true }

  it("a direction reversal restarts the accumulator, so one threshold of UP travel restores", () => {
    const s = reduceMinimize(minimized, 300 - MINIMIZE_THRESHOLD) // -14 in one frame
    expect(s.minimized).toBe(false)
    expect(s.accum).toBe(-MINIMIZE_THRESHOLD)
  })

  it("a small upward jiggle does NOT restore (needs a full threshold of upward travel)", () => {
    const jiggle = feed(minimized, [296, 292]) // -4, -4 = -8, under threshold
    expect(jiggle.minimized).toBe(true)
    const more = feed(jiggle, [288, 284]) // another -8 -> past -14
    expect(more.minimized).toBe(false)
  })

  it("continuing down-scroll past the clamp keeps it minimized (no drift)", () => {
    const s = feed(minimized, [340, 380, 420])
    expect(s.minimized).toBe(true)
    expect(s.accum).toBe(MINIMIZE_THRESHOLD)
  })
})

describe("reduceMinimize overscroll bounce", () => {
  it("clamps negative offsets (rubber-band past the top) to 0 and restores", () => {
    const minimized: MinimizeState = { lastY: 200, accum: MINIMIZE_THRESHOLD, minimized: true, primed: true }
    const s = reduceMinimize(minimized, -40)
    expect(s.minimized).toBe(false)
    expect(s.lastY).toBe(0)
  })

  it("an equal-offset frame is a no-op on the decision", () => {
    const minimized: MinimizeState = { lastY: 200, accum: MINIMIZE_THRESHOLD, minimized: true, primed: true }
    const s = reduceMinimize(minimized, 200)
    expect(s.minimized).toBe(true)
    expect(s.accum).toBe(MINIMIZE_THRESHOLD)
  })
})

describe("reduceMinimize honours custom thresholds", () => {
  it("uses the supplied threshold + minOffset", () => {
    const primed: MinimizeState = { lastY: 100, accum: 0, minimized: false, primed: true }
    // With a tiny threshold of 4, a 5pt down-scroll collapses.
    expect(reduceMinimize(primed, 105, { threshold: 4 }).minimized).toBe(true)
    // With a large minOffset, an offset under it forces open.
    expect(reduceMinimize({ ...primed, minimized: true }, 50, { minOffset: 80 }).minimized).toBe(false)
  })
})
