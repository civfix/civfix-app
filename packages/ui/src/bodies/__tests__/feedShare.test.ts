/**
 * The pure half of "Share to the feed": the wire-input contract, the preview projections, the optimistic
 * PostDTO, the failure classifier and the retry dedupe scan.
 */
import { describe, expect, it } from "vitest"
import { AppError, ErrorCode, type PersonDTO, type PostDTO } from "@civfix/shared"
import {
  FEED_CAPTION_COUNTER_AT,
  FEED_CAPTION_MAX,
  buildEventPreviewCard,
  buildFeedShareInput,
  buildOptimisticFeedSharePost,
  buildReportPreviewCard,
  classifyFeedShareFailure,
  findExistingFeedPost,
} from "../feedShare"

const me: PersonDTO = {
  id: "person-1",
  name: "Roman Aytur",
  handle: "roman",
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 3,
  following: 4,
  isFollowing: false,
}

describe("caption contract", () => {
  it("exports the 280 cap and the 240 counter threshold", () => {
    expect(FEED_CAPTION_MAX).toBe(280)
    expect(FEED_CAPTION_COUNTER_AT).toBe(240)
  })
})

describe("buildFeedShareInput", () => {
  it("returns null when the user did not opt in", () => {
    expect(buildFeedShareInput({ enabled: false, caption: "hi" }, { reportId: "r1" })).toBeNull()
  })

  it("OMITS body (never sends an empty string) for a blank or whitespace-only caption", () => {
    for (const caption of ["", "   ", "\n\t "]) {
      const input = buildFeedShareInput({ enabled: true, caption }, { reportId: "r1" })
      expect(input).not.toBeNull()
      expect(input).not.toHaveProperty("body")
      expect(input).toMatchObject({ kind: "post", reportId: "r1", mediaUploadIds: [], mentionedUserIds: [] })
    }
  })

  it("trims and slices a 281-char caption to exactly 280", () => {
    const input = buildFeedShareInput({ enabled: true, caption: "x".repeat(281) }, { reportId: "r1" })
    expect(input?.body).toHaveLength(280)
  })

  it("attaches an eventId when the target is an event", () => {
    const input = buildFeedShareInput({ enabled: true, caption: "come!" }, { eventId: "e1" })
    expect(input).toMatchObject({ kind: "post", body: "come!", eventId: "e1" })
    expect(input).not.toHaveProperty("reportId")
  })
})

describe("buildReportPreviewCard", () => {
  it("projects the local draft, including the LOCAL capture uri as the thumb", () => {
    const card = buildReportPreviewCard(
      {
        category: "trash",
        reportTypeId: "dump",
        title: "  Sofa on the sidewalk  ",
        addr: "123 Main St",
        media: [{ uri: "file:///tmp/a.jpg" }],
      },
      "Untitled report",
    )
    expect(card).toMatchObject({
      category: "trash",
      type: "dump",
      title: "Sofa on the sidewalk",
      status: "published",
      thumbUrl: "file:///tmp/a.jpg",
      addr: "123 Main St",
    })
  })

  it("falls back to the wizard's untitled copy and a null thumb", () => {
    const card = buildReportPreviewCard(
      { category: null, reportTypeId: null, title: "   ", addr: null, media: [] },
      "Untitled report",
    )
    expect(card.title).toBe("Untitled report")
    expect(card.thumbUrl).toBeNull()
  })
})

describe("buildEventPreviewCard", () => {
  const date = new Date("2026-08-01T00:00:00.000Z")
  const time = new Date("2026-08-01T00:00:00.000Z")

  it("returns null until title + date + time all exist", () => {
    const base = { eventKind: "cleanup" as const, coords: { lat: 1, lng: 2 } }
    expect(buildEventPreviewCard({ ...base, title: "", date, time }, me)).toBeNull()
    expect(buildEventPreviewCard({ ...base, title: "Beach", date: null, time }, me)).toBeNull()
    expect(buildEventPreviewCard({ ...base, title: "Beach", date, time: null }, me)).toBeNull()
  })

  it("builds a LinkedEventRef once the three fields exist", () => {
    const card = buildEventPreviewCard(
      { title: " Beach cleanup ", eventKind: "cleanup", coords: { lat: 1, lng: 2 }, date, time },
      me,
      "2026-07-25T00:00:00.000Z",
    )
    expect(card).toMatchObject({
      title: "Beach cleanup",
      eventKind: "cleanup",
      status: "upcoming",
      lat: 1,
      lng: 2,
      organizer: me,
      linkedAt: "2026-07-25T00:00:00.000Z",
    })
  })
})

describe("buildOptimisticFeedSharePost", () => {
  const report = {
    id: "report-1",
    category: "trash" as const,
    type: "dump" as const,
    title: "Sofa on the sidewalk",
    lat: 34,
    lng: -118,
    addr: "123 Main St",
  }

  it("carries the report id + linkedAt and a NULL thumbUrl (the local overlay supplies the photo)", () => {
    const post = buildOptimisticFeedSharePost({
      author: me,
      caption: "This has been here a week.",
      report,
      now: "2026-07-25T00:00:00.000Z",
    })
    expect(post.report).toMatchObject({
      id: "report-1",
      title: "Sofa on the sidewalk",
      status: "published",
      thumbUrl: null,
      linkedAt: "2026-07-25T00:00:00.000Z",
    })
    expect(post.body).toBe("This has been here a week.")
    expect(post.event).toBeNull()
    expect(post.media).toEqual([])
  })

  it("uses a NULL body for a blank caption and the server's own 'Report' title fallback", () => {
    const post = buildOptimisticFeedSharePost({
      author: me,
      caption: "   ",
      report: { ...report, title: "  " },
    })
    expect(post.body).toBeNull()
    expect(post.report?.title).toBe("Report")
  })

  it("carries the event id when the target is an event", () => {
    const event = {
      id: "event-1",
      title: "Beach cleanup",
      eventKind: "cleanup" as const,
      status: "upcoming" as const,
      scheduledAt: "2026-08-01T16:00:00.000Z",
      lat: 1,
      lng: 2,
      going: 1,
      organizer: me,
      linkedAt: "2026-07-25T00:00:00.000Z",
    }
    const post = buildOptimisticFeedSharePost({ author: me, caption: "", event })
    expect(post.event?.id).toBe("event-1")
    expect(post.report).toBeNull()
  })
})

describe("classifyFeedShareFailure", () => {
  it("maps VALIDATION to a NON-retryable rejection", () => {
    expect(classifyFeedShareFailure(new AppError(ErrorCode.VALIDATION, "nope"))).toEqual({
      reason: "rejected",
      retryable: false,
    })
  })

  it("maps RATE_LIMITED to a retryable rate-limit", () => {
    expect(classifyFeedShareFailure(new AppError(ErrorCode.RATE_LIMITED, "slow down"))).toEqual({
      reason: "rate-limited",
      retryable: true,
    })
  })

  it("maps everything else to a retryable network failure", () => {
    expect(classifyFeedShareFailure(new AppError(ErrorCode.INTERNAL, "boom"))).toEqual({
      reason: "network",
      retryable: true,
    })
    expect(classifyFeedShareFailure(new Error("offline"))).toEqual({
      reason: "network",
      retryable: true,
    })
  })
})

describe("findExistingFeedPost", () => {
  const post = (id: string, over: Partial<PostDTO> = {}): PostDTO => ({
    id,
    author: me,
    kind: "post",
    body: null,
    createdAt: "2026-07-25T00:00:00.000Z",
    editedAt: null,
    counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
    viewer: { liked: false, reposted: false, saved: false },
    media: [],
    mentions: [],
    event: null,
    report: null,
    repostOf: null,
    replyToId: null,
    threadRootId: null,
    ...over,
  })
  const reportRef = {
    id: "report-1",
    category: "trash" as const,
    title: "Sofa",
    status: "published" as const,
    lat: 1,
    lng: 2,
    linkedAt: "2026-07-25T00:00:00.000Z",
  }
  const eventRef = {
    id: "event-1",
    title: "Beach cleanup",
    eventKind: "cleanup" as const,
    status: "upcoming" as const,
    scheduledAt: "2026-08-01T16:00:00.000Z",
    lat: 1,
    lng: 2,
    going: 1,
    organizer: me,
    linkedAt: "2026-07-25T00:00:00.000Z",
  }

  it("matches on report.id", () => {
    const page = { items: [post("p0"), post("p1", { report: reportRef })] }
    expect(findExistingFeedPost(page, { reportId: "report-1" }, me.id)).toBe("p1")
  })

  it("matches on event.id", () => {
    const page = { items: [post("p1", { event: eventRef })] }
    expect(findExistingFeedPost(page, { eventId: "event-1" }, me.id)).toBe("p1")
  })

  it("returns null on an empty / absent page and on a different author", () => {
    expect(findExistingFeedPost({ items: [] }, { reportId: "report-1" }, me.id)).toBeNull()
    expect(findExistingFeedPost(null, { reportId: "report-1" }, me.id)).toBeNull()
    const other = { items: [post("p1", { report: reportRef, author: { ...me, id: "someone-else" } })] }
    expect(findExistingFeedPost(other, { reportId: "report-1" }, me.id)).toBeNull()
  })
})
