import { describe, it, expect } from "vitest"
import { BACK_SWIPE_EDGE_PX, SWIPE_CAPTURE_SLOP_PX } from "../backSwipeEdge"
import {
  SWIPE_ACTIONS_FLING_VX,
  SWIPE_ACTION_WIDTH_PX,
  actionsProgress,
  actionsRestingX,
  actionsTranslate,
  actionsWidth,
  shouldCaptureActionsSwipe,
  shouldSnapOpen,
} from "../swipeActionsModel"

describe("actionsWidth", () => {
  it("is one lane per action, and zero when there is nothing to reveal", () => {
    expect(actionsWidth(1)).toBe(SWIPE_ACTION_WIDTH_PX)
    expect(actionsWidth(2)).toBe(SWIPE_ACTION_WIDTH_PX * 2)
    expect(actionsWidth(0)).toBe(0)
    expect(actionsWidth(-1)).toBe(0)
  })
})

describe("shouldCaptureActionsSwipe", () => {
  it("captures a LEFT, horizontally-dominant drag past slop on a closed row", () => {
    expect(shouldCaptureActionsSwipe(-40, 5, false)).toBe(true)
    expect(shouldCaptureActionsSwipe(-(SWIPE_CAPTURE_SLOP_PX + 1), -8, false)).toBe(true)
  })

  it("never captures a right drag on a closed row - there is no affordance that way", () => {
    expect(shouldCaptureActionsSwipe(40, 0, false)).toBe(false)
    expect(shouldCaptureActionsSwipe(100, 5, false)).toBe(false)
  })

  it("captures EITHER direction once open, so the row can be dragged shut", () => {
    expect(shouldCaptureActionsSwipe(40, 0, true)).toBe(true)
    expect(shouldCaptureActionsSwipe(-40, 0, true)).toBe(true)
  })

  it("declines a dy-dominant drag so the list keeps its vertical scroll", () => {
    expect(shouldCaptureActionsSwipe(-12, 30, false)).toBe(false)
    expect(shouldCaptureActionsSwipe(-12, -30, true)).toBe(false)
  })

  it("declines a drag within slop", () => {
    expect(shouldCaptureActionsSwipe(-SWIPE_CAPTURE_SLOP_PX, 0, false)).toBe(false)
    expect(shouldCaptureActionsSwipe(4, 1, true)).toBe(false)
  })
})

describe("actionsRestingX / actionsTranslate", () => {
  const width = actionsWidth(2)

  it("rests at 0 closed and at -width open", () => {
    expect(actionsRestingX(false, width)).toBe(0)
    expect(actionsRestingX(true, width)).toBe(-width)
  })

  it("follows the finger from the CURRENT rest, clamped [-width, 0]", () => {
    expect(actionsTranslate(-30, 0, width)).toBe(-30)
    expect(actionsTranslate(-1000, 0, width)).toBe(-width)
    expect(actionsTranslate(30, 0, width)).toBe(0)
    expect(actionsTranslate(20, -width, width)).toBe(-width + 20)
    expect(actionsTranslate(1000, -width, width)).toBe(0)
  })
})

describe("actionsProgress", () => {
  const width = actionsWidth(2)

  it("is linear toward the fully-open offset, clamped [0, 1]", () => {
    expect(actionsProgress(-width / 2, width)).toBeCloseTo(0.5)
    expect(actionsProgress(-width, width)).toBe(1)
    expect(actionsProgress(-width * 2, width)).toBe(1)
    expect(actionsProgress(10, width)).toBe(0)
    expect(actionsProgress(-10, 0)).toBe(0)
  })
})

describe("shouldSnapOpen", () => {
  const width = actionsWidth(2)

  it("snaps open past half the lane and closed before it", () => {
    expect(shouldSnapOpen(-width * 0.6, width, 0)).toBe(true)
    expect(shouldSnapOpen(-width * 0.4, width, 0)).toBe(false)
    expect(shouldSnapOpen(-width * 0.5, width, 0)).toBe(true)
  })

  it("lets a fling decide regardless of distance", () => {
    expect(shouldSnapOpen(-4, width, -SWIPE_ACTIONS_FLING_VX)).toBe(true)
    expect(shouldSnapOpen(-width + 2, width, SWIPE_ACTIONS_FLING_VX)).toBe(false)
  })

  it("never opens a row with no actions", () => {
    expect(shouldSnapOpen(-200, 0, -2)).toBe(false)
  })
})

describe("the back-swipe edge is not the row's to claim", () => {
  it("only the RIGHTWARD drag can collide with the edge pop, so only that one is excluded", () => {
    expect(shouldCaptureActionsSwipe(80, 0, true, 0)).toBe(false)
    expect(shouldCaptureActionsSwipe(80, 0, true, BACK_SWIPE_EDGE_PX)).toBe(false)
  })

  it("reveals the lane on a LEFTWARD drag that began inside the edge - the pop goes the other way", () => {
    expect(shouldCaptureActionsSwipe(-80, 0, false, 0)).toBe(true)
    expect(shouldCaptureActionsSwipe(-80, 0, true, BACK_SWIPE_EDGE_PX)).toBe(true)
  })

  it("still drags an open row shut from outside the edge", () => {
    expect(shouldCaptureActionsSwipe(80, 0, true, BACK_SWIPE_EDGE_PX + 1)).toBe(true)
  })

  it("captures when no touch-down was recorded, so an untracked gesture is never mistaken for an edge one", () => {
    expect(shouldCaptureActionsSwipe(-80, 0, false)).toBe(true)
    expect(shouldCaptureActionsSwipe(80, 0, true)).toBe(true)
  })
})
