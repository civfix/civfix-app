/**
 * `dockKeyboardRestOffset` is the `restOffset` the docked search bar hands `useKeyboardAnchor`, derived
 * from two terms, never guessed: `dockBottomGap(safeAreaBottom)` (the dock container's paddingBottom) and
 * the dead band under the slimmed glass at full morph (DOCK_MORPH_SHRINK - DOCK_MORPH_TOP_OFFSET).
 */
import { describe, expect, it } from "vitest"
import {
  DOCK_BOTTOM_MARGIN,
  dockBottomGap,
  dockKeyboardRestOffset,
} from "../tabBarLogic"
import { DOCK_MORPH_SHRINK, DOCK_MORPH_TOP_OFFSET } from "../../surface/liquidGlass/liquidGlassModel"
import { keyboardLift } from "../keyboardInsetModel"

describe("dockKeyboardRestOffset", () => {
  it("is 36pt on a 34pt-inset iPhone: the exact dead gap measured in the simulator", () => {
    expect(dockKeyboardRestOffset(34)).toBe(36)
  })
  it("is 22pt on a zero-inset device", () => {
    expect(dockKeyboardRestOffset(0)).toBe(22)
  })
  it("stays the sum of its two derived terms at every inset", () => {
    const deadBand = DOCK_MORPH_SHRINK - DOCK_MORPH_TOP_OFFSET
    expect(deadBand).toBe(14)
    for (const inset of [0, 8, 20, 34, 48]) {
      expect(dockKeyboardRestOffset(inset)).toBe(dockBottomGap(inset) + deadBand)
    }
  })
  it("leaves dockBottomGap itself untouched", () => {
    expect(dockBottomGap(34)).toBe(22)
    expect(dockBottomGap(0)).toBe(DOCK_BOTTOM_MARGIN)
  })

  it("TRACKS the Android nav-bar reservation instead of desyncing from it", () => {
    // Why the Android reservation lives inside dockBottomGap rather than at TabBar.native's paddingBottom:
    // the rest offset grows by the same 20dp, so `keyboardLift` still lands the bar 8dp above the IME.
    // Added at the call site, the bar would rise 20dp too far.
    const deadBand = DOCK_MORPH_SHRINK - DOCK_MORPH_TOP_OFFSET
    expect(dockKeyboardRestOffset(48, "android")).toBe(dockBottomGap(48, "android") + deadBand)
    expect(dockKeyboardRestOffset(48, "android") - dockKeyboardRestOffset(48)).toBe(20)
    expect(dockKeyboardRestOffset(24, "android") - dockKeyboardRestOffset(24)).toBe(20)
  })

  it("defaults to the iOS branch, so every existing call site is unchanged", () => {
    for (const inset of [0, 8, 20, 34, 48, 64]) {
      expect(dockKeyboardRestOffset(inset)).toBe(dockKeyboardRestOffset(inset, "other"))
    }
    expect(dockKeyboardRestOffset(34)).toBe(36)
  })
})

describe("the docked bar's keyboard arithmetic end to end", () => {
  it("lifts 317pt onto a 345pt keyboard on a 34pt-inset device", () => {
    expect(keyboardLift(345, dockKeyboardRestOffset(34), 8)).toBe(317)
  })
  it("lands the bar exactly 8pt above the keyboard top", () => {
    // 874pt window, keyboard top y529 (overlap 345). Resting bar bottom = 874 - 36 = y838.
    const windowH = 874
    const keyboardTop = 529
    const restOffset = dockKeyboardRestOffset(34)
    const restingBarBottom = windowH - restOffset
    const risenBarBottom = restingBarBottom - keyboardLift(windowH - keyboardTop, restOffset, 8)
    expect(restingBarBottom).toBe(838)
    expect(risenBarBottom).toBe(keyboardTop - 8)
    expect(risenBarBottom).toBe(521)
  })
})
