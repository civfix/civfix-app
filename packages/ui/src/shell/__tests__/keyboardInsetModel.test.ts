/**
 * The PURE keyboard model (shell/keyboardInsetModel.ts) — the leaf both `useKeyboardAnchor` seams
 * consume. Every number here is the arithmetic behind the primary sim measurement: the docked search
 * bar's bottom edge must land 8pt above the keyboard top, not 36pt above it.
 *
 * Geometry of record (iPhone 17 Pro, 874pt window, 34pt bottom inset, 345pt keyboard):
 *   keyboard top y529 -> overlap 345; dock rest offset 36 -> lift 317; risen bar bottom y521.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  androidKeyboardInset,
  keyboardMirrorOverlap,
  keyboardOverlapFrom,
  keyboardViewportOverlap,
  reduceKeyboard,
  shouldRecaptureRestingHeight,
  type KeyboardCommand,
  type KeyboardPhase,
} from "../keyboardInsetModel"

describe("the pure model stays the RN-free leaf both platform seams consume", () => {
  const model = () => readFileSync(new URL("../keyboardInsetModel.ts", import.meta.url), "utf8")

  it("imports nothing at all — every platform fact arrives as a parameter", () => {
    expect(model()).not.toMatch(/^import /m)
    expect(model()).not.toMatch(/from "react-native"/)
  })

  it("takes the system-bar inset as a REQUIRED input, never an implicit default", () => {
    expect(model()).toMatch(
      /export interface KeyboardViewportOverlapInput \{[\s\S]*?\n {2}systemBarInset: number\n\}/,
    )
    expect(model()).not.toMatch(/systemBarInset: number = /)
  })
})

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
  it("takes the HEIGHT branch on Android — screenY is the window bottom, not the keyboard top", () => {
    expect(keyboardOverlapFrom({ screenY: 529, height: 345 }, 874, "android")).toBe(345)
  })
  it("is zero for a missing event", () => {
    expect(keyboardOverlapFrom(undefined, 874, "ios")).toBe(0)
    expect(keyboardOverlapFrom(undefined, 874, "android")).toBe(0)
    expect(keyboardOverlapFrom({}, 874, "other")).toBe(0)
  })
})

describe("androidKeyboardInset", () => {
  it("keeps the full keyboard when edge-to-edge nullified adjustResize", () => {
    expect(androidKeyboardInset(345, 874, 874)).toBe(345)
  })

  it("keeps nothing when the window already resized by the whole keyboard", () => {
    expect(androidKeyboardInset(345, 874, 529)).toBe(0)
  })

  it("keeps the remainder on a partial resize", () => {
    expect(androidKeyboardInset(345, 874, 700)).toBe(171)
  })

  it("never reserves on a closed keyboard", () => {
    expect(androidKeyboardInset(0, 874, 874)).toBe(0)
  })
})

describe("keyboardViewportOverlap", () => {
  const android = (
    endCoordinates: { screenY?: number; height?: number } | undefined,
    windowHeight: number,
    restingWindowHeight: number,
    systemBarInset: number,
  ) =>
    keyboardViewportOverlap({
      endCoordinates,
      windowHeight,
      restingWindowHeight,
      platform: "android",
      systemBarInset,
    })

  it("is keyboardOverlapFrom on iOS — the screenY branch, resting height and system bar ignored", () => {
    const ios = (
      endCoordinates: { screenY?: number; height?: number } | undefined,
      windowHeight: number,
      restingWindowHeight: number,
      systemBarInset: number,
    ) =>
      keyboardViewportOverlap({
        endCoordinates,
        windowHeight,
        restingWindowHeight,
        platform: "ios",
        systemBarInset,
      })
    expect(ios({ screenY: 529, height: 345 }, 874, 874, 0)).toBe(345)
    expect(ios({ screenY: 529, height: 345 }, 874, 700, 34)).toBe(345)
    expect(ios({ screenY: 874 }, 874, 874, 0)).toBe(0)
  })

  it("covers the WHOLE keyboard on an Android window edge-to-edge never resized", () => {
    expect(android({ screenY: 874, height: 297 }, 874, 874, 48)).toBe(345)
    expect(android({ screenY: 874, height: 297 }, 874, 874, 0)).toBe(297)
  })

  it("covers NOTHING on a legacy Android window that genuinely resized", () => {
    expect(android({ screenY: 529, height: 345 }, 529, 874, 0)).toBe(0)
  })

  it("covers the remainder when the window resized only partly", () => {
    expect(android({ screenY: 700, height: 345 }, 700, 874, 0)).toBe(171)
  })

  it("is zero for a missing or closed keyboard on every platform", () => {
    expect(android(undefined, 874, 874, 48)).toBe(0)
    expect(android({ height: 0 }, 874, 874, 48)).toBe(0)
    expect(
      keyboardViewportOverlap({
        endCoordinates: undefined,
        windowHeight: 874,
        restingWindowHeight: 874,
        platform: "ios",
        systemBarInset: 0,
      }),
    ).toBe(0)
    expect(
      keyboardViewportOverlap({
        endCoordinates: {},
        windowHeight: 874,
        restingWindowHeight: 874,
        platform: "other",
        systemBarInset: 0,
      }),
    ).toBe(0)
  })
})

describe("keyboardMirrorOverlap — the UI-thread mirror lands in the JS thread's units", () => {
  const NAV_BAR = 48
  const WINDOW = 874
  const IME_BOTTOM_INSET = 345
  const RN_EVENT_HEIGHT = IME_BOTTOM_INSET - NAV_BAR

  const jsReserve = () =>
    keyboardViewportOverlap({
      endCoordinates: { height: RN_EVENT_HEIGHT },
      windowHeight: WINDOW,
      restingWindowHeight: WINDOW,
      platform: "android",
      systemBarInset: NAV_BAR,
    })

  it("agrees with the JS reservation under edge-to-edge, where reanimated already counted the nav bar", () => {
    const uiMirror = keyboardMirrorOverlap({
      reanimatedHeight: IME_BOTTOM_INSET,
      systemBarInset: NAV_BAR,
      edgeToEdge: true,
    })
    expect(uiMirror).toBe(jsReserve())
    expect(uiMirror).toBe(345)
  })

  it("agrees with it OFF edge-to-edge too, where reanimated subtracted the nav bar exactly as RN did", () => {
    const uiMirror = keyboardMirrorOverlap({
      reanimatedHeight: RN_EVENT_HEIGHT,
      systemBarInset: NAV_BAR,
      edgeToEdge: false,
    })
    expect(uiMirror).toBe(jsReserve())
    expect(uiMirror).toBe(345)
  })

  it("lands the docked search bar KEYBOARD_SURFACE_GAP above the keyboard from EITHER source", () => {
    const restOffset = NAV_BAR + 8 + (36 - 34)
    const fromMirror = keyboardLift(
      keyboardMirrorOverlap({ reanimatedHeight: IME_BOTTOM_INSET, systemBarInset: NAV_BAR, edgeToEdge: true }),
      restOffset,
      KEYBOARD_SURFACE_GAP,
    )
    expect(fromMirror).toBe(keyboardLift(jsReserve(), restOffset, KEYBOARD_SURFACE_GAP))
    expect(fromMirror).toBe(295)
  })

  it("is zero for a closed keyboard, so the nav bar is never published as a phantom overlap", () => {
    expect(keyboardMirrorOverlap({ reanimatedHeight: 0, systemBarInset: NAV_BAR, edgeToEdge: true })).toBe(0)
    expect(keyboardMirrorOverlap({ reanimatedHeight: 0, systemBarInset: NAV_BAR, edgeToEdge: false })).toBe(0)
  })

  it("has no nav bar to add on iOS, where the mirror and the event already agree", () => {
    expect(keyboardMirrorOverlap({ reanimatedHeight: 345, systemBarInset: 0, edgeToEdge: false })).toBe(345)
  })
})

describe("shouldRecaptureRestingHeight — a rotation is not a keyboard", () => {
  it("takes any resize while the keyboard is closed", () => {
    expect(shouldRecaptureRestingHeight({ keyboardOpen: false, prevWidth: 402, nextWidth: 402 })).toBe(true)
    expect(shouldRecaptureRestingHeight({ keyboardOpen: false, prevWidth: 402, nextWidth: 874 })).toBe(true)
  })

  it("REFUSES the keyboard's own resize — same width, only the height moved", () => {
    expect(shouldRecaptureRestingHeight({ keyboardOpen: true, prevWidth: 402, nextWidth: 402 })).toBe(false)
  })

  it("takes a rotation even with the keyboard up, or the lift stays clamped to 0 until it closes", () => {
    expect(shouldRecaptureRestingHeight({ keyboardOpen: true, prevWidth: 402, nextWidth: 874 })).toBe(true)
  })
})

describe("the Android reserve useKeyboardReserve applies (keyboardViewportOverlap -> keyboardLift, gap 0)", () => {
  const reserve = (restOffset: number, systemBarInset: number) =>
    keyboardLift(
      keyboardViewportOverlap({
        endCoordinates: { screenY: 874, height: 297 },
        windowHeight: 874,
        restingWindowHeight: 874,
        platform: "android",
        systemBarInset,
      }),
      restOffset,
      0,
    )

  it("lifts a surface that DROPS its safe-area pad by the whole window overlap", () => {
    expect(reserve(0, 48)).toBe(345)
  })

  it("lifts a surface that KEEPS its safe-area pad by the overlap ABOVE that pad", () => {
    expect(reserve(48, 48)).toBe(297)
  })

  it("lands the docked search bar exactly on the keyboard, nav bar included", () => {
    const overlap = keyboardViewportOverlap({
      endCoordinates: { screenY: 874, height: 297 },
      windowHeight: 874,
      restingWindowHeight: 874,
      platform: "android",
      systemBarInset: 48,
    })
    expect(keyboardLift(overlap, 48 + 8 + (36 - 34), KEYBOARD_SURFACE_GAP)).toBe(295)
  })

  it("reserves NOTHING with the keyboard closed, whatever the pad", () => {
    expect(reserve(0, 48)).toBeGreaterThan(0)
    expect(
      keyboardLift(
        keyboardViewportOverlap({
          endCoordinates: { height: 0 },
          windowHeight: 874,
          restingWindowHeight: 874,
          platform: "android",
          systemBarInset: 48,
        }),
        0,
        0,
      ),
    ).toBe(0)
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
