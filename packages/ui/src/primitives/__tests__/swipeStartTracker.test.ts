import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import { BACK_SWIPE_EDGE_PX } from "../backSwipeEdge"
import { shouldCaptureSwipe } from "../swipeReplyModel"
import { shouldCaptureActionsSwipe } from "../swipeActionsModel"
import { UNTRACKED_SWIPE_START_X, createSwipeStartTracker } from "../swipeStartTracker"

const REPLY_HOOK = readFileSync(new URL("../useSwipeReply.ts", import.meta.url), "utf8")
const ACTIONS_HOOK = readFileSync(new URL("../useSwipeActions.ts", import.meta.url), "utf8")

describe("createSwipeStartTracker", () => {
  it("reads untracked until a touch-down is recorded, so a stray move never claims the edge", () => {
    const tracker = createSwipeStartTracker()
    expect(tracker.startX()).toBe(UNTRACKED_SWIPE_START_X)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(true)
    expect(shouldCaptureActionsSwipe(-80, 0, false, tracker.startX())).toBe(true)
  })

  it("records the touch-down page X and hands it to the capture rules", () => {
    const tracker = createSwipeStartTracker()
    tracker.noteTouchStart(220)
    expect(tracker.startX()).toBe(220)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(true)
  })

  it("refuses a bubble swipe that began inside the back-swipe edge", () => {
    const tracker = createSwipeStartTracker()
    tracker.noteTouchStart(BACK_SWIPE_EDGE_PX)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(false)
    tracker.noteTouchStart(BACK_SWIPE_EDGE_PX + 1)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(true)
  })

  it("keeps the last touch-down across gestures and re-reads it per touch", () => {
    const tracker = createSwipeStartTracker()
    tracker.noteTouchStart(4)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(false)
    tracker.noteTouchStart(300)
    expect(shouldCaptureSwipe(80, 0, tracker.startX())).toBe(true)
  })

  it("treats a missing or non-finite page X as untracked rather than as the screen edge", () => {
    const tracker = createSwipeStartTracker()
    tracker.noteTouchStart(Number.NaN)
    expect(tracker.startX()).toBe(UNTRACKED_SWIPE_START_X)
    tracker.noteTouchStart(undefined as unknown as number)
    expect(tracker.startX()).toBe(UNTRACKED_SWIPE_START_X)
  })
})

describe("the swipe hooks never read gestureState.x0", () => {
  it("would be zero at move-negotiation time, which killed every native swipe", () => {
    for (const source of [REPLY_HOOK, ACTIONS_HOOK]) {
      expect(source).not.toContain("g.x0")
      expect(source).toContain("startTracker.noteTouchStart(evt.nativeEvent.pageX)")
      expect(source).toContain("startTracker.startX()")
    }
  })
})
