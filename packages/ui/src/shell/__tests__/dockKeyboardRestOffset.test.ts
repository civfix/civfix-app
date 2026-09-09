/**
 * `dockKeyboardRestOffset` (shell/tabBarLogic.ts) — the `restOffset` the docked search bar hands
 * `useKeyboardAnchor`, and the reason the bar can land exactly 8pt above the keyboard instead of 36pt.
 *
 * It is DERIVED from two terms, never guessed:
 *   1. dockBottomGap(safeAreaBottom) — the dock container's paddingBottom.
 *   2. The dead band under the slimmed glass at full morph: DOCK_MORPH_SHRINK - DOCK_MORPH_TOP_OFFSET.
 *
 * Lives in its own file rather than in tabBar.test.ts so this wave adds no edit to an existing suite.
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
  it("is 36pt on a 34pt-inset iPhone — the exact dead gap measured in the simulator", () => {
    // Bar bottom y494 vs keyboard top y529 before the fix.
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
    // THE reason the Android fix lives inside dockBottomGap rather than at TabBar.native's paddingBottom.
    // The gap term grows by 20dp on Android; because this function is defined ON TOP of dockBottomGap,
    // the rest offset grows by exactly the same 20dp and `keyboardLift` keeps landing the bar 8dp above
    // the IME. Had the reservation been added at the call site, restOffset would still report the old,
    // smaller gap and the bar would rise 20dp too far — resting ~28dp above the keyboard.
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
