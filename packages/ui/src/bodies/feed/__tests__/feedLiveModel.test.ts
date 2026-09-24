import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import {
  FEED_TOP_CLEAR_OFFSET,
  addPendingNewPost,
  clearsPendingAtOffset,
  dedupePostsById,
  shouldAnnounceNewPosts,
} from "../../../data/feedLiveModel"
import { useFeedLiveStore } from "../../../data/feedLiveStore"

describe("addPendingNewPost", () => {
  it("accumulates ids in arrival order", () => {
    expect(addPendingNewPost(addPendingNewPost([], "a"), "b")).toEqual(["a", "b"])
  })

  it("dedupes a repeated id and keeps the SAME array identity for the no-op", () => {
    const once = addPendingNewPost([], "a")
    expect(addPendingNewPost(once, "a")).toBe(once)
  })
})

describe("clearsPendingAtOffset", () => {
  it("clears only when the reader has actually reached the top", () => {
    expect(clearsPendingAtOffset(0, 3)).toBe(true)
    expect(clearsPendingAtOffset(FEED_TOP_CLEAR_OFFSET, 3)).toBe(true)
    expect(clearsPendingAtOffset(-40, 3)).toBe(true)
    expect(clearsPendingAtOffset(FEED_TOP_CLEAR_OFFSET + 1, 3)).toBe(false)
    expect(clearsPendingAtOffset(400, 3)).toBe(false)
  })

  it("never clears when nothing is pending, so top-of-list scrolling stays write-free", () => {
    expect(clearsPendingAtOffset(0, 0)).toBe(false)
  })
})

describe("dedupePostsById", () => {
  it("keeps the FIRST occurrence and preserves server rank order", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "c" }]
    expect(dedupePostsById(items).map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("returns the same array identity when nothing is duplicated", () => {
    const items = [{ id: "a" }, { id: "b" }]
    expect(dedupePostsById(items)).toBe(items)
  })
})

describe("useFeedLiveStore", () => {
  beforeEach(() => {
    useFeedLiveStore.getState().adoptViewer("viewer-a")
    useFeedLiveStore.getState().clearNewPosts()
  })

  it("counts distinct new posts and clears on demand", () => {
    const store = useFeedLiveStore
    store.getState().noteNewPost("p1")
    store.getState().noteNewPost("p2")
    store.getState().noteNewPost("p1")
    expect(store.getState().pendingNewPostIds).toEqual(["p1", "p2"])
    store.getState().clearNewPosts()
    expect(store.getState().pendingNewPostIds).toEqual([])
  })

  it("a duplicate note and an empty clear both leave the state identity untouched", () => {
    const store = useFeedLiveStore
    const empty = store.getState().pendingNewPostIds
    store.getState().clearNewPosts()
    expect(store.getState().pendingNewPostIds).toBe(empty)
    store.getState().noteNewPost("p1")
    const one = store.getState().pendingNewPostIds
    store.getState().noteNewPost("p1")
    expect(store.getState().pendingNewPostIds).toBe(one)
  })

  it("drops the pending ids on SIGN-OUT, so a count never greets the next account", () => {
    const store = useFeedLiveStore
    store.getState().noteNewPost("p1")
    store.getState().noteNewPost("p2")
    store.getState().adoptViewer(null)
    expect(store.getState().pendingNewPostIds).toEqual([])
  })

  it("drops the pending ids on an account SWITCH", () => {
    const store = useFeedLiveStore
    store.getState().noteNewPost("p1")
    store.getState().adoptViewer("viewer-b")
    expect(store.getState().pendingNewPostIds).toEqual([])
  })

  it("KEEPS the pending ids when the same viewer is re-adopted, which is every feed remount", () => {
    const store = useFeedLiveStore
    store.getState().noteNewPost("p1")
    const pending = store.getState().pendingNewPostIds
    store.getState().adoptViewer("viewer-a")
    store.getState().adoptViewer("viewer-a")
    expect(store.getState().pendingNewPostIds).toBe(pending)
  })

  it("clears the ids a signed-out reader accumulated when someone signs in", () => {
    const store = useFeedLiveStore
    store.getState().adoptViewer(null)
    store.getState().noteNewPost("p1")
    store.getState().adoptViewer("viewer-c")
    expect(store.getState().pendingNewPostIds).toEqual([])
  })
})

describe("shouldAnnounceNewPosts", () => {
  it("speaks once when the pill appears, not on every later arrival or when it clears", () => {
    expect(shouldAnnounceNewPosts(0, 1)).toBe(true)
    expect(shouldAnnounceNewPosts(0, 3)).toBe(true)
    expect(shouldAnnounceNewPosts(1, 2)).toBe(false)
    expect(shouldAnnounceNewPosts(2, 0)).toBe(false)
    expect(shouldAnnounceNewPosts(0, 0)).toBe(false)
  })

  it("is what the pill uses to announce on native, where there is no polite live region", () => {
    const source = readFileSync(new URL("../NewPostsPill.tsx", import.meta.url), "utf8")
    expect(source).toContain("ANNOUNCES_NATIVELY && shouldAnnounceNewPosts(previous, count)")
    expect(source).toContain("AccessibilityInfo.announceForAccessibility(label)")
  })
})
