import { afterEach, describe, expect, it, vi } from "vitest"
import type { PersonDTO } from "@civfix/shared"
import {
  FEED_CAPTION_MAX,
  buildEventPreviewCard,
  buildFeedShareInput,
  buildOptimisticFeedSharePost,
  buildReportPreviewCard,
  classifyFeedShareFailure,
  findExistingFeedPost,
  personFromAuthUser,
} from "../feedShare"

const me: PersonDTO = {
  id: "person-1",
  name: "Roman",
  handle: "roman",
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

afterEach(() => vi.useRealTimers())

describe("personFromAuthUser", () => {
  it("projects the signed-in user onto a zero-count person", () => {
    expect(
      personFromAuthUser({ id: "u1", displayName: "Maria", handle: "maria", avatarUrl: "https://x/a.jpg" }),
    ).toEqual({
      id: "u1",
      name: "Maria",
      handle: "maria",
      bio: null,
      avatar: null,
      avatarUrl: "https://x/a.jpg",
      followers: 0,
      following: 0,
      isFollowing: false,
    })
  })

  it("nulls a missing handle and avatar", () => {
    expect(personFromAuthUser({ id: "u1", displayName: "Maria" })).toMatchObject({
      handle: null,
      avatarUrl: null,
    })
  })
})

describe("buildFeedShareInput edges", () => {
  it("trims before slicing, so leading space never costs caption characters", () => {
    const caption = `   ${"a".repeat(FEED_CAPTION_MAX)}`
    expect(buildFeedShareInput({ enabled: true, caption }, { reportId: "r" })?.body).toBe("a".repeat(FEED_CAPTION_MAX))
  })

  it("always sends empty media and mention lists", () => {
    expect(buildFeedShareInput({ enabled: true, caption: "hi" }, { reportId: "r" })).toEqual({
      kind: "post",
      body: "hi",
      reportId: "r",
      mediaUploadIds: [],
      mentionedUserIds: [],
    })
  })
})

describe("buildReportPreviewCard edges", () => {
  it("defaults an unchosen category to other and an unchosen type to null", () => {
    const card = buildReportPreviewCard(
      { category: null, reportTypeId: null, title: "Couch", addr: null, media: [] },
      "Untitled",
    )
    expect(card).toEqual({
      id: "draft",
      category: "other",
      type: null,
      title: "Couch",
      status: "published",
      thumbUrl: null,
      addr: null,
    })
  })

  it("uses the first capture as the thumb", () => {
    const card = buildReportPreviewCard(
      { category: "trash", reportTypeId: "dump", title: "", addr: "1 Main", media: [{ uri: "a" }, { uri: "b" }] },
      "Untitled",
    )
    expect(card).toMatchObject({ thumbUrl: "a", title: "Untitled", type: "dump", addr: "1 Main" })
  })
})

describe("buildEventPreviewCard edges", () => {
  const date = new Date(2026, 7, 1)
  const time = new Date(2000, 0, 1, 9, 30)

  it("merges the chosen day with the chosen clock and counts the organizer as going", () => {
    const card = buildEventPreviewCard(
      { title: "Beach", eventKind: "cleanup", coords: { lat: 1, lng: 2 }, date, time },
      me,
      "now",
    )
    expect(card?.scheduledAt).toBe(new Date(2026, 7, 1, 9, 30).toISOString())
    expect(card).toMatchObject({ id: "draft", going: 1 })
  })

  it("places a location-less draft at 0,0", () => {
    const card = buildEventPreviewCard({ title: "Beach", eventKind: "cleanup", coords: null, date, time }, me)
    expect(card).toMatchObject({ lat: 0, lng: 0 })
  })

  it("rejects a whitespace-only title", () => {
    expect(buildEventPreviewCard({ title: "   ", eventKind: "cleanup", coords: null, date, time }, me)).toBeNull()
  })
})

describe("buildOptimisticFeedSharePost shape", () => {
  it("builds a zero-count, unengaged top-level post with a time-derived optimistic id", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-25T10:00:00.000Z"))
    const post = buildOptimisticFeedSharePost({ author: me, caption: "Hi" })
    expect(post).toEqual({
      id: `optimistic-${Date.parse("2026-07-25T10:00:00.000Z")}`,
      author: me,
      kind: "post",
      body: "Hi",
      createdAt: "2026-07-25T10:00:00.000Z",
      editedAt: null,
      counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
      viewer: { liked: false, reposted: false, saved: false },
      media: [],
      mentions: [],
      repostOf: null,
      replyToId: null,
      threadRootId: null,
      event: null,
      report: null,
    })
  })

  it("slices the caption to the feed cap", () => {
    const post = buildOptimisticFeedSharePost({ author: me, caption: "b".repeat(FEED_CAPTION_MAX + 20) })
    expect(post.body).toHaveLength(FEED_CAPTION_MAX)
  })

  it("omits a missing report type and nulls a missing address", () => {
    const post = buildOptimisticFeedSharePost({
      author: me,
      caption: "",
      report: { id: "r", category: "hazard", type: null, title: "Hole", lat: 1, lng: 2 },
      now: "2026-07-25T10:00:00.000Z",
    })
    expect(post.report).toEqual({
      id: "r",
      category: "hazard",
      title: "Hole",
      status: "published",
      lat: 1,
      lng: 2,
      addr: null,
      thumbUrl: null,
      linkedAt: "2026-07-25T10:00:00.000Z",
    })
  })

  it("carries a report and an event together when both are given", () => {
    const event = buildEventPreviewCard(
      { title: "Beach", eventKind: "cleanup", coords: null, date: new Date(2026, 7, 1), time: new Date(2000, 0, 1, 9) },
      me,
      "t",
    )
    const post = buildOptimisticFeedSharePost({
      author: me,
      caption: "",
      event,
      report: { id: "r", category: "trash", title: "x", lat: 1, lng: 2 },
    })
    expect(post.event).toBe(event)
    expect(post.report?.id).toBe("r")
  })
})

describe("classifyFeedShareFailure edges", () => {
  it("classifies a cross-realm AppError clone by its code", () => {
    expect(classifyFeedShareFailure({ name: "AppError", code: "VALIDATION", message: "x" })).toEqual({
      reason: "rejected",
      retryable: false,
    })
  })

  it("treats a non-error value as a retryable network failure", () => {
    expect(classifyFeedShareFailure(undefined)).toEqual({ reason: "network", retryable: true })
    expect(classifyFeedShareFailure("boom")).toEqual({ reason: "network", retryable: true })
  })
})

describe("findExistingFeedPost edges", () => {
  it("returns the first matching post and skips null or author-less items", () => {
    const hit = { id: "p2", author: me, report: { id: "r" }, event: null }
    const later = { id: "p3", author: me, report: { id: "r" }, event: null }
    const page = { items: [null, { id: "p1", author: null, report: { id: "r" } }, hit, later] } as never
    expect(findExistingFeedPost(page, { reportId: "r" }, me.id)).toBe("p2")
  })

  it("never matches an event target against a report link", () => {
    const page = { items: [{ id: "p1", author: me, report: { id: "x" }, event: null }] } as never
    expect(findExistingFeedPost(page, { eventId: "x" }, me.id)).toBeNull()
  })
})
