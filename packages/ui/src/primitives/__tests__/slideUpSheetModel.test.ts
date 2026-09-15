import { describe, expect, it } from "vitest"
import {
  SLIDE_UP_DISMISS_DISTANCE,
  SLIDE_UP_DISMISS_VELOCITY,
  slideUpDragOffset,
  slideUpDragOutcome,
  slideUpSheetMaxHeight,
  slideUpShouldCapture,
} from "../slideUpSheetModel"

describe("slide-up sheet drag model", () => {
  it("captures a downward, mostly vertical drag and leaves taps and sideways swipes alone", () => {
    expect(slideUpShouldCapture(0, 12)).toBe(true)
    expect(slideUpShouldCapture(2, 3)).toBe(false)
    expect(slideUpShouldCapture(30, 10)).toBe(false)
    expect(slideUpShouldCapture(0, -20)).toBe(false)
  })

  it("never lets the sheet be dragged above its resting position", () => {
    expect(slideUpDragOffset(-40)).toBe(0)
    expect(slideUpDragOffset(25)).toBe(25)
  })

  it("dismisses on a long drag or a flick, settles back otherwise", () => {
    expect(slideUpDragOutcome(SLIDE_UP_DISMISS_DISTANCE, 0, 600)).toBe("dismiss")
    expect(slideUpDragOutcome(SLIDE_UP_DISMISS_DISTANCE - 1, 0, 600)).toBe("settle")
    expect(slideUpDragOutcome(20, SLIDE_UP_DISMISS_VELOCITY, 600)).toBe("dismiss")
    expect(slideUpDragOutcome(20, 0.2, 600)).toBe("settle")
    expect(slideUpDragOutcome(-10, 5, 600)).toBe("settle")
  })

  it("halves the distance for a short sheet so it cannot demand a drag longer than itself", () => {
    expect(slideUpDragOutcome(60, 0, 100)).toBe("dismiss")
    expect(slideUpDragOutcome(60, 0, null)).toBe("settle")
  })
})

describe("slide-up sheet height under the keyboard", () => {
  it("keeps the resting ratio while no keyboard lift is reserved, whatever the top inset", () => {
    expect(slideUpSheetMaxHeight(874, 0.9, 0)).toBeCloseTo(786.6)
    expect(slideUpSheetMaxHeight(874, 0.9, 0, 62)).toBeCloseTo(786.6)
    expect(slideUpSheetMaxHeight(874, 0.9, -20, 62)).toBeCloseTo(786.6)
  })

  it("gives the lift back as height so a lifted sheet's top stays below the top inset", () => {
    expect(slideUpSheetMaxHeight(874, 0.9, 311)).toBe(563)
    expect(slideUpSheetMaxHeight(874, 0.9, 311, 62)).toBe(501)
    expect(slideUpSheetMaxHeight(874, 0.5, 311, 62)).toBe(437)
  })
})
