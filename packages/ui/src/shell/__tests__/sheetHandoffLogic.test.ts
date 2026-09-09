/**
 * The PURE sheet-handoff math (shell/sheetHandoffLogic.ts) — the content-scroll -> sheet-drag handoff
 * that makes a pull-down at the top of a sheet body collapse the sheet.
 *
 * Positions are gorhom's `animatedPosition`: the sheet's TOP edge in container px, LARGER = lower on
 * screen. The detent list of record for an 874pt window is [756 (peek), 378 (mid), 91 (full)].
 *
 * THE REGRESSION THIS FILE EXISTS FOR: gorhom's `animateToPosition` early-returns on
 * `position === animatedPosition.get()` BEFORE it emits onAnimate/onChange, so a drag that lands EXACTLY
 * on the peek detent silently strands the sheet — visually collapsed, store still on the old snap, no
 * recovery path. Hence FLOOR_EPSILON, and hence `handoffDestinationIndex` returning an INDEX (a position
 * that is not an exact `detents` member makes gorhom's `indexOf` return -1, which routes into
 * handleOnClose == a full sheet dismissal).
 */
import { describe, expect, it } from "vitest"
import {
  FLOOR_EPSILON,
  HANDOFF_AXIS_RATIO,
  HANDOFF_SLOP,
  handoffDestinationIndex,
  handoffPosition,
  shouldEngageHandoff,
} from "../sheetHandoffLogic"

const PEEK = 756
const MID = 378
const FULL = 91
const DETENTS = [PEEK, MID, FULL] as const

describe("shouldEngageHandoff", () => {
  it("engages only past the slop, and only downward", () => {
    expect(HANDOFF_SLOP).toBe(8)
    expect(shouldEngageHandoff(0, 9, HANDOFF_SLOP)).toBe(true)
    expect(shouldEngageHandoff(0, 7, HANDOFF_SLOP)).toBe(false)
    expect(shouldEngageHandoff(0, -50, HANDOFF_SLOP)).toBe(false)
  })
  it("never engages while the list still has content above it", () => {
    expect(shouldEngageHandoff(40, 50, HANDOFF_SLOP)).toBe(false)
  })
  it("defaults its slop to the exported constant", () => {
    // The literal default exists because reanimated cannot capture a module const in a worklet's
    // default-parameter list; this pins the literal to HANDOFF_SLOP.
    expect(shouldEngageHandoff(0, 9)).toBe(shouldEngageHandoff(0, 9, HANDOFF_SLOP))
    expect(shouldEngageHandoff(0, 8)).toBe(false)
  })
  it("leaves a DOMINANTLY HORIZONTAL drag to the scroller under the finger", () => {
    // The report detail's photo strip and the event detail's linked-reports strip are plain RN
    // horizontal ScrollViews the host never wraps, so the `horizontal` pass-through cannot see them.
    // Without the axis test, a sideways swipe with the usual ~10pt of downward drift activated the
    // ancestor pan, cancelled the strip's scroll and dragged the sheet toward peek instead.
    expect(shouldEngageHandoff(0, 10, HANDOFF_SLOP, -120)).toBe(false)
    expect(shouldEngageHandoff(0, 10, HANDOFF_SLOP, 120)).toBe(false)
    // Exactly at the ratio is not dominant enough; comfortably past it is.
    expect(shouldEngageHandoff(0, 30, HANDOFF_SLOP, 20)).toBe(false)
    expect(shouldEngageHandoff(0, 30, HANDOFF_SLOP, 10)).toBe(true)
  })
  it("defaults dx to 0, so a caller that passes none behaves exactly as a straight pull-down", () => {
    expect(shouldEngageHandoff(0, 9, HANDOFF_SLOP)).toBe(
      shouldEngageHandoff(0, 9, HANDOFF_SLOP, 0),
    )
  })
  it("pins the axis literal to HANDOFF_AXIS_RATIO (worklet const-capture trap)", () => {
    expect(HANDOFF_AXIS_RATIO).toBe(1.5)
    // dy sits a hair either side of dx * HANDOFF_AXIS_RATIO.
    expect(shouldEngageHandoff(0, 20 * HANDOFF_AXIS_RATIO + 0.5, HANDOFF_SLOP, 20)).toBe(true)
    expect(shouldEngageHandoff(0, 20 * HANDOFF_AXIS_RATIO - 0.5, HANDOFF_SLOP, 20)).toBe(false)
  })
})

describe("handoffPosition", () => {
  it("loses no pixels: the sheet moves exactly as far as the finger did since the baseline", () => {
    expect(handoffPosition(MID, 100, 100, FULL, PEEK)).toBe(MID)
    expect(handoffPosition(MID, 160, 100, FULL, PEEK)).toBe(MID + 60)
  })
  it("is downward-only — an upward pull gives the drag back to the scroll view", () => {
    expect(handoffPosition(MID, 40, 100, FULL, PEEK)).toBe(MID)
  })
  it("clamps EPSILON-SHORT of the peek floor, never exactly on it", () => {
    // The whole point: an exact landing makes gorhom's animateToPosition early-return before it emits
    // any callback, stranding the sheet at peek with the store still on the old snap.
    expect(handoffPosition(MID, 1000, 0, FULL, PEEK)).toBe(PEEK - FLOOR_EPSILON)
    expect(handoffPosition(MID, 1000, 0, FULL, PEEK)).toBe(755.5)
    expect(handoffPosition(MID, 1000, 0, FULL, PEEK)).not.toBe(PEEK)
  })
  it("clamps EPSILON-SHORT of the full ceiling too", () => {
    expect(handoffPosition(FULL, -1000, 0, FULL, PEEK)).toBe(FULL + FLOOR_EPSILON)
    expect(handoffPosition(FULL, -1000, 0, FULL, PEEK)).toBe(91.5)
  })
  it("re-baselines cleanly on a round trip (no jump, no double motion, no lost travel)", () => {
    // Finger down at mid, drag to +120, back to 0, the list takes over, re-baseline, drag +30.
    let base = MID
    let baseT = 0
    expect(handoffPosition(base, 120, baseT, FULL, PEEK)).toBe(498)
    expect(handoffPosition(base, 0, baseT, FULL, PEEK)).toBe(MID)
    // The caller re-baselines the frame the list starts consuming the drag again.
    base = MID
    baseT = 0
    expect(handoffPosition(base, 30, baseT, FULL, PEEK)).toBe(408)
  })
})

describe("handoffDestinationIndex", () => {
  it("returns an INDEX, so the caller can only ever hand gorhom an exact detent member", () => {
    const list: number[] = [PEEK, MID, FULL]
    const i = handoffDestinationIndex(400, 0, list)
    expect(i).toBe(1)
    expect(list[i]).toBe(MID)
    // This is the structural guarantee: gorhom derives its index with `detents.indexOf(position)` and
    // maps -1 to handleOnClose (a FULL dismissal). Reading detents[i] can never produce a non-member.
    expect(list.indexOf(list[i] as number)).toBe(i)
  })
  it("projects the release velocity the same way gorhom's own snapPoint does", () => {
    expect(handoffDestinationIndex(400, 1500, DETENTS)).toBe(0) // flung DOWN -> peek
    expect(handoffDestinationIndex(400, -1500, DETENTS)).toBe(2) // flung UP -> full
  })
  it("returns -1 for an empty detent list rather than guessing", () => {
    expect(handoffDestinationIndex(400, 0, [])).toBe(-1)
  })
  it("skips sparse holes without ever returning an index the caller cannot read", () => {
    const sparse = [PEEK, undefined, FULL] as unknown as readonly number[]
    const i = handoffDestinationIndex(400, 0, sparse)
    expect(i).not.toBe(1)
    expect(sparse[i]).toBeTypeOf("number")
  })
})
