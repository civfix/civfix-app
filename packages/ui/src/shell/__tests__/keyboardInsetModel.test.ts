/**
 * The PURE keyboard model (shell/keyboardInsetModel.ts) — the leaf both `useKeyboardAnchor` seams
 * consume. Every number here is the arithmetic behind the primary sim measurement: the docked search
 * bar's bottom edge must land 8pt above the keyboard top, not 36pt above it.
 *
 * Geometry of record (iPhone 17 Pro, 874pt window, 34pt bottom inset, 345pt keyboard):
 *   keyboard top y529 -> overlap 345; dock rest offset 36 -> lift 317; risen bar bottom y521.
 */
import { describe, expect, it } from "vitest"
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  keyboardOverlapFrom,
  reduceKeyboard,
  type KeyboardCommand,
  type KeyboardPhase,
} from "../keyboardInsetModel"

describe("keyboardLift", () => {
  it("is zero with no keyboard", () => {
    expect(keyboardLift(0, 36)).toBe(0)
    expect(keyboardLift(-5, 36)).toBe(0)
  })
  it("lifts the NATIVE docked bar 317pt onto a 345pt keyboard", () => {
    expect(keyboardLift(345, 36, 8)).toBe(317)
  })
  it("lifts the WEB docked bar 331pt (rest offset 22, not 12)", () => {
    expect(keyboardLift(345, 22, 8)).toBe(331)
  })
  it("never goes negative when the surface already clears the keyboard", () => {
    expect(keyboardLift(20, 36, 8)).toBe(0)
  })
  it("is monotone non-decreasing in overlap", () => {
    let prev = -1
    for (let o = 0; o <= 400; o += 5) {
      const l = keyboardLift(o, 36, 8)
      expect(l).toBeGreaterThanOrEqual(prev)
      prev = l
    }
  })
  it("pins the literal default equal to KEYBOARD_SURFACE_GAP", () => {
    // The `gap = 8` default is a LITERAL on purpose: reanimated cannot capture a module const referenced
    // in a worklet's default-parameter list. This is the guard that the literal never drifts from the const.
    expect(KEYBOARD_SURFACE_GAP).toBe(8)
    expect(keyboardLift(0, 36)).toBe(keyboardLift(0, 36, KEYBOARD_SURFACE_GAP))
    expect(keyboardLift(345, 36)).toBe(keyboardLift(345, 36, KEYBOARD_SURFACE_GAP))
  })
})

describe("keyboardAnimationDuration", () => {
  it("falls back when the platform reports nothing (Android is documented always 0)", () => {
    expect(keyboardAnimationDuration(undefined, 250, 600)).toBe(250)
    expect(keyboardAnimationDuration(0, 250, 600)).toBe(250)
  })
  it("uses the OS's own reported duration", () => {
    expect(keyboardAnimationDuration(250, 250, 600)).toBe(250)
    expect(keyboardAnimationDuration(310, 250, 600)).toBe(310)
  })
  it("clamps a pathological duration", () => {
    expect(keyboardAnimationDuration(9999, 250, 600)).toBe(600)
  })
})

describe("keyboardOverlapFrom", () => {
  it("takes the screenY branch on iOS (endCoordinates are already in WINDOW space)", () => {
    expect(keyboardOverlapFrom({ screenY: 529, height: 345 }, 874, "ios")).toBe(345)
    expect(keyboardOverlapFrom({ screenY: 874 }, 874, "ios")).toBe(0)
  })
  it("takes the HEIGHT branch on Android — the window already excludes the keyboard", () => {
    // `winH - screenY` would DOUBLE-COUNT under adjustResize (KeyboardAwareScroll.native.tsx:94-97).
    expect(keyboardOverlapFrom({ screenY: 529, height: 345 }, 874, "android")).toBe(345)
  })
  it("is zero for a missing event", () => {
    expect(keyboardOverlapFrom(undefined, 874, "ios")).toBe(0)
    expect(keyboardOverlapFrom(undefined, 874, "android")).toBe(0)
    expect(keyboardOverlapFrom({}, 874, "other")).toBe(0)
  })
})

describe("the iOS keyboard progress curves", () => {
  it.each([
    ["open", iosKeyboardOpenEasing],
    ["close", iosKeyboardCloseEasing],
  ])("%s is a well-formed, strictly increasing 0->1 curve", (_name, f) => {
    expect(f(0)).toBeCloseTo(0, 6)
    expect(f(1)).toBeCloseTo(1, 6)
    let prev = -1
    for (let x = 0; x <= 1.0001; x += 0.02) {
      const y = f(x)
      expect(y).toBeGreaterThan(prev)
      prev = y
    }
    // Front-loaded like the real keyboard: past halfway in travel at the halfway point in time.
    expect(f(0.5)).toBeGreaterThan(0.5)
  })
  it("clamps out-of-range input rather than diverging", () => {
    expect(iosKeyboardOpenEasing(-1)).toBeCloseTo(0, 6)
    expect(iosKeyboardOpenEasing(2)).toBeCloseTo(1, 6)
  })
})

describe("reduceKeyboard — the ownership matrix", () => {
  const IDLE: KeyboardPhase = "idle"
  const ENGAGED: KeyboardPhase = "engaged"

  it("will-show while OWNED engages and reserves the overlap", () => {
    expect(reduceKeyboard(IDLE, { type: "will-show", overlap: 345, duration: 250, enabled: true })).toEqual(
      { phase: "engaged", target: 345, duration: 250, reserveOverlap: 345 },
    )
  })
  it("will-show while NOT owned is inert — the dock must not move for a foreign field", () => {
    expect(reduceKeyboard(IDLE, { type: "will-show", overlap: 345, duration: 250, enabled: false })).toEqual(
      { phase: "idle", target: 0, duration: 0, reserveOverlap: 0 },
    )
  })
  it("will-hide from ENGAGED animates down and HOLDS the reservation", () => {
    // Zeroing the reserve here would collapse the content box one frame after blur, while the bar and
    // the keyboard are both still travelling down.
    expect(
      reduceKeyboard(ENGAGED, { type: "will-hide", duration: 250, reserveHint: 345 }),
    ).toEqual({ phase: "engaged", target: 0, duration: 250, reserveOverlap: 345 })
  })
  it("will-hide from IDLE is inert", () => {
    expect(reduceKeyboard(IDLE, { type: "will-hide", duration: 250, reserveHint: 345 })).toEqual({
      phase: "idle",
      target: 0,
      duration: 0,
      reserveOverlap: 0,
    })
  })
  it("did-settle with a live keyboard we own snaps to the true overlap with no animation", () => {
    expect(reduceKeyboard(ENGAGED, { type: "did-settle", overlap: 345, enabled: true })).toEqual({
      phase: "engaged",
      target: 345,
      duration: 0,
      reserveOverlap: 345,
    })
  })
  it("did-settle at zero releases everything, including the held reservation", () => {
    expect(reduceKeyboard(ENGAGED, { type: "did-settle", overlap: 0, enabled: true })).toEqual({
      phase: "idle",
      target: 0,
      duration: 0,
      reserveOverlap: 0,
    })
  })
  it("did-settle while un-owned releases too", () => {
    expect(reduceKeyboard(ENGAGED, { type: "did-settle", overlap: 345, enabled: false })).toEqual({
      phase: "idle",
      target: 0,
      duration: 0,
      reserveOverlap: 0,
    })
  })
  it("GAINING ownership of an already-raised keyboard adopts it over the handoff duration", () => {
    expect(
      reduceKeyboard(IDLE, { type: "ownership", enabled: true, liveOverlap: 345, handoffMs: 220 }),
    ).toEqual({ phase: "engaged", target: 345, duration: 220, reserveOverlap: 345 })
  })
  it("gaining ownership with NO keyboard up changes nothing", () => {
    expect(
      reduceKeyboard(IDLE, { type: "ownership", enabled: true, liveOverlap: 0, handoffMs: 220 }),
    ).toEqual({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 })
  })
  it("re-asserting ownership while already engaged does not re-animate", () => {
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: true, liveOverlap: 345, handoffMs: 220 }),
    ).toEqual({ phase: "engaged", target: 345, duration: 0, reserveOverlap: 345 })
  })
  it("LOSING ownership while engaged rides back down over the handoff duration", () => {
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220 }),
    ).toEqual({ phase: "idle", target: 0, duration: 220, reserveOverlap: 0 })
  })
  it("losing ownership we never had is inert", () => {
    expect(
      reduceKeyboard(IDLE, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220 }),
    ).toEqual({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 })
  })
  it("losing ownership MID-CLOSE CARRIES the reservation instead of collapsing it in one frame", () => {
    // THE defect. iOS posts keyboardWillHide FIRST (the will-hide branch above HOLDS the reserve) and the
    // field's blur lands one tick LATER. Zeroing the reserve on that blur re-laid-out the search layer's
    // scroll content (411 -> 94 of bottom padding, iPhone 17 Pro) in a single un-animated frame, mid-descent.
    expect(
      reduceKeyboard(ENGAGED, {
        type: "ownership",
        enabled: false,
        liveOverlap: 345,
        handoffMs: 220,
        closing: true,
        reserveHint: 345,
      }),
    ).toEqual({ phase: "engaged", target: 0, duration: 220, reserveOverlap: 345 })
  })
  // GUARD (green before this task): the carry-at-will-hide logic must keep reserveOverlap alive until did-settle
  // (never released at blur, only at landing after the keyboard has settled).
  it("releases the CARRIED reservation at did-settle, never at the blur", () => {
    // The landing is the ONLY release. By then the keyboard is down, so the layout step is invisible.
    expect(reduceKeyboard(ENGAGED, { type: "did-settle", overlap: 0, enabled: false })).toEqual({
      phase: "idle",
      target: 0,
      duration: 0,
      reserveOverlap: 0,
    })
  })
  it("carries nothing when no hint is supplied rather than inventing a reservation", () => {
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220, closing: true }),
    ).toEqual({ phase: "engaged", target: 0, duration: 220, reserveOverlap: 0 })
  })
  // GUARD (green before this task): non-close ownership loss must not reserve (another surface owns the keyboard
  // while it stays visible, so we transition to idle immediately without carrying the reservation).
  it("still releases immediately when the ownership loss is NOT a close (the foreign-keyboard handoff)", () => {
    // Another surface's field took the keyboard while it stays UP: we own nothing, so we reserve nothing.
    expect(
      reduceKeyboard(ENGAGED, { type: "ownership", enabled: false, liveOverlap: 345, handoffMs: 220, closing: false }),
    ).toEqual({ phase: "idle", target: 0, duration: 220, reserveOverlap: 0 })
  })
  // GUARD (green before this task): ownership loss during a close while in idle state (we never owned the keyboard)
  // must stay inert and not falsely carry the hint (only engaged closes can carry).
  it("a mid-close ownership loss we never owned is still inert", () => {
    expect(
      reduceKeyboard(IDLE, {
        type: "ownership",
        enabled: false,
        liveOverlap: 345,
        handoffMs: 220,
        closing: true,
        reserveHint: 345,
      }),
    ).toEqual({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 })
  })
})

describe("isRedundantClose — one close, ONE curve", () => {
  // The will-hide close (target 0) is already running on the OS's own reported duration when the blur's
  // ownership command arrives with the same target on keyboardHandoffMs. Applying it restarts an ease-out
  // mid-flight: the dock re-accelerates while the real keyboard keeps decelerating.
  const BLUR_CLOSE: KeyboardCommand = { phase: "engaged", target: 0, duration: 220, reserveOverlap: 345 }

  it("skips the blur command that lands on a still-running will-hide close", () => {
    expect(isRedundantClose(BLUR_CLOSE, 0)).toBe(true)
  })
  it("applies the command when nothing is in flight", () => {
    expect(isRedundantClose(BLUR_CLOSE, null)).toBe(false)
  })
  it("NEVER skips the landing — a zero-duration command is what releases the carried reserve", () => {
    expect(isRedundantClose({ phase: "idle", target: 0, duration: 0, reserveOverlap: 0 }, 0)).toBe(false)
  })
  it("applies a command with a DIFFERENT target — a will-show retargeting mid-close must win", () => {
    expect(isRedundantClose({ phase: "engaged", target: 345, duration: 250, reserveOverlap: 345 }, 0)).toBe(false)
  })
  it("treats a 0 in-flight target as a real record, not as absent", () => {
    // The close everyone cares about targets exactly 0; a falsy check here would disable the whole fix.
    expect(isRedundantClose(BLUR_CLOSE, 0)).toBe(true)
    expect(isRedundantClose({ ...BLUR_CLOSE, target: 345 }, 345)).toBe(true)
  })
})
