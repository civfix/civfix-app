import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import { FEED_COUNTS_MAX_IDS } from "@civfix/shared"
import type { FeedPageDTO, PersonDTO, PostDTO } from "@civfix/shared"
import { queryKeys } from "../../keys"
import { patchPostCountsInCaches } from "../posts"
import { FEED_COUNTS_DEBOUNCE_MS, createFeedCountsBatcher } from "../feedRealtime"

function person(id: string): PersonDTO {
  return {
    id,
    name: `User ${id}`,
    handle: id,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

function post(id: string, overrides: Partial<PostDTO> = {}): PostDTO {
  return {
    id,
    author: person("me"),
    kind: "post",
    body: `body ${id}`,
    createdAt: "2026-09-15T00:00:00.000Z",
    counts: { likes: 5, reposts: 2, replies: 1, saves: 0 },
    viewer: { liked: true, reposted: false, saved: false },
    media: [],
    mentions: [],
    event: null,
    report: null,
    repostOf: null,
    replyToId: null,
    threadRootId: null,
    ...overrides,
  }
}

function feed(items: PostDTO[]): InfiniteData<FeedPageDTO> {
  return { pages: [{ items, nextCursor: null }], pageParams: [undefined] }
}

const FEED_ALL = queryKeys.homeFeed("all", "me")

describe("createFeedCountsBatcher", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("batches every id noted within the window into ONE deduplicated fetch", () => {
    const calls: string[][] = []
    const batcher = createFeedCountsBatcher(async (ids) => {
      calls.push(ids)
    })
    batcher.note("a")
    batcher.note("b")
    batcher.note("a")
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS - 1)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual([["a", "b"]])
  })

  it("starts a fresh window after a flush instead of fetching per signal", () => {
    const calls: string[][] = []
    const batcher = createFeedCountsBatcher(async (ids) => {
      calls.push(ids)
    })
    batcher.note("a")
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS)
    batcher.note("b")
    batcher.note("c")
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS)
    expect(calls).toEqual([["a"], ["b", "c"]])
  })

  it("caps a flush at the contract's FEED_COUNTS_MAX_IDS", () => {
    const calls: string[][] = []
    const batcher = createFeedCountsBatcher(async (ids) => {
      calls.push(ids)
    })
    for (let i = 0; i < FEED_COUNTS_MAX_IDS + 25; i++) batcher.note(`p${i}`)
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(FEED_COUNTS_MAX_IDS)
  })

  it("a rejecting fetch neither throws nor leaves a stuck timer", async () => {
    const batcher = createFeedCountsBatcher(async () => {
      throw new Error("offline")
    })
    batcher.note("a")
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS)
    await vi.runAllTimersAsync()
    batcher.note("b")
    expect(() => vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS)).not.toThrow()
  })

  it("dispose drops the pending buffer and cancels the flush", () => {
    const calls: string[][] = []
    const batcher = createFeedCountsBatcher(async (ids) => {
      calls.push(ids)
    })
    batcher.note("a")
    batcher.dispose()
    vi.advanceTimersByTime(FEED_COUNTS_DEBOUNCE_MS * 2)
    expect(calls).toEqual([])
  })
})

describe("patchPostCountsInCaches", () => {
  it("patches counts in place across the list caches AND the post detail, keeping viewer state", () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("p1"), post("p2")]))
    qc.setQueryData(queryKeys.post("p1"), post("p1"))

    patchPostCountsInCaches(qc, [
      { id: "p1", counts: { likes: 9, reposts: 4, replies: 3, saves: 2 } },
    ])

    const page = qc.getQueryData<InfiniteData<FeedPageDTO>>(FEED_ALL)!.pages[0]!
    const patched = page.items.find((p) => p.id === "p1")!
    expect(patched.counts).toEqual({ likes: 9, reposts: 4, replies: 3, saves: 2 })
    expect(patched.viewer).toEqual({ liked: true, reposted: false, saved: false })
    expect(page.items.find((p) => p.id === "p2")!.counts.likes).toBe(5)
    expect(qc.getQueryData<PostDTO>(queryKeys.post("p1"))!.counts.likes).toBe(9)
  })

  it("never invalidates the feed - the list must not reshuffle under the reader", () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("p1")]))
    patchPostCountsInCaches(qc, [
      { id: "p1", counts: { likes: 1, reposts: 0, replies: 0, saves: 0 } },
    ])
    expect(qc.getQueryState(FEED_ALL)?.isInvalidated).toBe(false)
  })

  it("tolerates ids the server left out and ids no cache holds", () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("p1")]))
    expect(() =>
      patchPostCountsInCaches(qc, [
        { id: "unknown", counts: { likes: 1, reposts: 0, replies: 0, saves: 0 } },
      ]),
    ).not.toThrow()
    expect(
      qc.getQueryData<InfiniteData<FeedPageDTO>>(FEED_ALL)!.pages[0]!.items[0]!.counts.likes,
    ).toBe(5)
    expect(qc.getQueryData(queryKeys.post("unknown"))).toBeUndefined()
  })
})
