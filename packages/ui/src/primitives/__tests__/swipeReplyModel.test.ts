import { describe, it, expect } from "vitest"
import { BACK_SWIPE_EDGE_PX, SWIPE_CAPTURE_SLOP_PX } from "../backSwipeEdge"
import {
  SWIPE_MAX_TRANSLATE_PX,
  SWIPE_TRIGGER_PX,
  shouldCaptureSwipe,
  shouldTriggerReply,
  swipeProgress,
  swipeTranslate,
} from "../swipeReplyModel"

describe("shouldCaptureSwipe", () => {
  it("captures a rightward, horizontally-dominant drag past slop", () => {
    expect(shouldCaptureSwipe(40, 5)).toBe(true)
    expect(shouldCaptureSwipe(SWIPE_CAPTURE_SLOP_PX + 1, -8)).toBe(true)
  })

  it("declines a dy-dominant drag (vertical scroll wins)", () => {
    expect(shouldCaptureSwipe(12, 30)).toBe(false)
    expect(shouldCaptureSwipe(12, -30)).toBe(false)
  })

  it("never captures a left drag, regardless of magnitude", () => {
    expect(shouldCaptureSwipe(-40, 0)).toBe(false)
    expect(shouldCaptureSwipe(-100, 5)).toBe(false)
  })

  it("declines a drag within slop", () => {
    expect(shouldCaptureSwipe(SWIPE_CAPTURE_SLOP_PX, 0)).toBe(false)
    expect(shouldCaptureSwipe(4, 1)).toBe(false)
  })
})

describe("shouldTriggerReply", () => {
  it("dx 40 does not trigger; dx 52 triggers (threshold 48 inclusive)", () => {
    expect(shouldTriggerReply(40)).toBe(false)
    expect(shouldTriggerReply(52)).toBe(true)
    expect(shouldTriggerReply(SWIPE_TRIGGER_PX)).toBe(true)
  })
})

describe("swipeTranslate", () => {
  it("follows the finger below the clamp, clamps at 64, floors at 0", () => {
    expect(swipeTranslate(30)).toBe(30)
    expect(swipeTranslate(120)).toBe(SWIPE_MAX_TRANSLATE_PX)
    expect(swipeTranslate(SWIPE_MAX_TRANSLATE_PX)).toBe(64)
    expect(swipeTranslate(-25)).toBe(0)
  })
})

describe("swipeProgress", () => {
  it("is linear toward the trigger threshold, clamped [0, 1]", () => {
    expect(swipeProgress(24)).toBeCloseTo(0.5)
    expect(swipeProgress(SWIPE_TRIGGER_PX)).toBe(1)
    expect(swipeProgress(96)).toBe(1)
    expect(swipeProgress(-10)).toBe(0)
  })
})

describe("the back-swipe edge is not the row's to claim", () => {
  it("refuses a rightward drag whose touch-down landed inside the edge, however far it travels", () => {
    expect(shouldCaptureSwipe(80, 0, 0)).toBe(false)
    expect(shouldCaptureSwipe(80, 0, BACK_SWIPE_EDGE_PX)).toBe(false)
  })

  it("still captures a drag that starts past the edge", () => {
    expect(shouldCaptureSwipe(80, 0, BACK_SWIPE_EDGE_PX + 1)).toBe(true)
  })

  it("captures when no touch-down was recorded, so an untracked gesture is never mistaken for an edge one", () => {
    expect(shouldCaptureSwipe(80, 0)).toBe(true)
    expect(shouldCaptureSwipe(80, 0, Number.POSITIVE_INFINITY)).toBe(true)
  })
})
