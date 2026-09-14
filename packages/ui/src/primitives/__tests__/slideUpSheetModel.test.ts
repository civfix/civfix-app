import { describe, expect, it } from "vitest"
import {
  SLIDE_UP_DISMISS_DISTANCE,
  SLIDE_UP_DISMISS_VELOCITY,
  slideUpDragOffset,
  slideUpDragOutcome,
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
