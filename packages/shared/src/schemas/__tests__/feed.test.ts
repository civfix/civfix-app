import { describe, it, expect } from "vitest"
import {
  DEFAULT_FEED_RANKING,
  FEED_COUNTS_MAX_IDS,
  FEED_SCORE_CURSOR_PRECISION,
  FeedCountsRequestSchema,
  FeedCountsResponseSchema,
  FeedRankingConfigSchema,
  FeedScoreCursorSchema,
  formatFeedScoreCursor,
  isAfterFeedScoreCursor,
  parseFeedScoreCursor,
  quantizeFeedScore,
} from "../posts.js"
import { SignalTopicSchema, UserSignalSchema, WsServerMessageSchema } from "../../types/ws.js"
import { endpoints } from "../../client/endpoints.js"

const UUID_A = "11111111-1111-1111-1111-111111111111"
const UUID_B = "22222222-2222-2222-2222-222222222222"

describe("FeedRankingConfigSchema", () => {
  it("parses an empty object into the full default profile", () => {
    const parsed = FeedRankingConfigSchema.parse({})
    expect(parsed).toEqual(DEFAULT_FEED_RANKING)
    expect(Object.keys(parsed)).toHaveLength(28)
  })

  it("carries the documented default weights", () => {
    expect(DEFAULT_FEED_RANKING).toEqual({
      baseWeight: 10,
      followWeight: 100,
      selfWeight: 60,
      mentionWeight: 40,
      nearbyWeight: 300,
      nearbyRadiusKm: 40,
      orgVerifiedWeight: 30,
      attachEventWeight: 30,
      attachReportWeight: 30,
      imageWeight: 5,
      likeWeight: 3,
      replyWeight: 8,
      repostWeight: 5,
      halfLifeHours: 36,
      decayFloor: 0.15,
      diversityFloor: 0.25,
      diversityDecay: 0.5,
      seenDiscount: 0.7,
      jitterAmount: 0.15,
      minScore: 12,
      minPageItems: 5,
      candidateWindowDays: 30,
      candidateCap: 400,
      clockBucketSeconds: 60,
      snapshotTtlSeconds: 180,
      servedTtlSeconds: 900,
      viewerFanoutMax: 500,
      newPostFanoutMax: 1000,
    })
  })

  it("merges a partial override onto the defaults", () => {
    const parsed = FeedRankingConfigSchema.parse({ halfLifeHours: 12, followWeight: 70 })
    expect(parsed.halfLifeHours).toBe(12)
    expect(parsed.followWeight).toBe(70)
    expect(parsed.minScore).toBe(DEFAULT_FEED_RANKING.minScore)
  })

  it("rejects an unknown key rather than ignoring it", () => {
    const res = FeedRankingConfigSchema.safeParse({ halfLifeHors: 12 })
    expect(res.success).toBe(false)
  })

  it("defaults the per-refresh jitter band and weights proximity above follow", () => {
    expect(DEFAULT_FEED_RANKING.jitterAmount).toBe(0.15)
    expect(DEFAULT_FEED_RANKING.nearbyWeight).toBe(300)
    expect(DEFAULT_FEED_RANKING.nearbyWeight).toBeGreaterThan(DEFAULT_FEED_RANKING.followWeight)
    expect(FeedRankingConfigSchema.parse({ jitterAmount: 0 }).jitterAmount).toBe(0)
    expect(FeedRankingConfigSchema.parse({ jitterAmount: 1 }).jitterAmount).toBe(1)
  })

  it("rejects a jitter band outside the unit interval", () => {
    expect(FeedRankingConfigSchema.safeParse({ jitterAmount: 1.01 }).success).toBe(false)
    expect(FeedRankingConfigSchema.safeParse({ jitterAmount: -0.01 }).success).toBe(false)
  })

  it("rejects out-of-range values", () => {
    expect(FeedRankingConfigSchema.safeParse({ decayFloor: 1.5 }).success).toBe(false)
    expect(FeedRankingConfigSchema.safeParse({ halfLifeHours: 0 }).success).toBe(false)
    expect(FeedRankingConfigSchema.safeParse({ candidateCap: 10 }).success).toBe(false)
    expect(FeedRankingConfigSchema.safeParse({ minPageItems: 2.5 }).success).toBe(false)
    expect(FeedRankingConfigSchema.safeParse({ followWeight: -1 }).success).toBe(false)
  })
})

describe("feed score cursor", () => {
  it("round-trips a score and a post id", () => {
    const encoded = formatFeedScoreCursor({ score: 115.9, postId: UUID_A })
    expect(encoded).toBe(`115.900000|${UUID_A}`)
    expect(parseFeedScoreCursor(encoded)).toEqual({ score: 115.9, postId: UUID_A })
  })

  it("quantises to six decimal places before encoding", () => {
    expect(FEED_SCORE_CURSOR_PRECISION).toBe(6)
    expect(quantizeFeedScore(13.12345678)).toBe(13.123457)
    const encoded = formatFeedScoreCursor({ score: 13.12345678, postId: UUID_A })
    expect(encoded).toBe(`13.123457|${UUID_A}`)
    expect(parseFeedScoreCursor(encoded)?.score).toBe(quantizeFeedScore(13.12345678))
  })

  it("round-trips a zero score", () => {
    const encoded = formatFeedScoreCursor({ score: 0, postId: UUID_B })
    expect(parseFeedScoreCursor(encoded)).toEqual({ score: 0, postId: UUID_B })
  })

  it("does not claim a legacy ISO time cursor", () => {
    expect(parseFeedScoreCursor(`2026-09-14T10:00:00.000Z|${UUID_A}`)).toBeNull()
  })

  it("returns null for anything that is not a score cursor", () => {
    expect(parseFeedScoreCursor(null)).toBeNull()
    expect(parseFeedScoreCursor(undefined)).toBeNull()
    expect(parseFeedScoreCursor("")).toBeNull()
    expect(parseFeedScoreCursor("12.5")).toBeNull()
    expect(parseFeedScoreCursor(`12.5|not-a-uuid-at-all-not-a-uuid-at-all`)).toBeNull()
    expect(parseFeedScoreCursor(`-12.5|${UUID_A}`)).toBeNull()
  })

  it("rejects a negative score at the schema boundary", () => {
    expect(FeedScoreCursorSchema.safeParse({ score: -1, postId: UUID_A }).success).toBe(false)
    expect(
      FeedScoreCursorSchema.safeParse({ score: 1, postId: UUID_A, extra: true }).success,
    ).toBe(false)
  })

  it("orders by score descending, then by post id descending", () => {
    const cursor = { score: 50, postId: UUID_B }
    expect(isAfterFeedScoreCursor({ score: 49.9, postId: UUID_A }, cursor)).toBe(true)
    expect(isAfterFeedScoreCursor({ score: 50.1, postId: UUID_A }, cursor)).toBe(false)
    expect(isAfterFeedScoreCursor({ score: 50, postId: UUID_A }, cursor)).toBe(true)
    expect(isAfterFeedScoreCursor(cursor, cursor)).toBe(false)
  })
})

describe("feed counts contract", () => {
  it("accepts a bounded batch of post ids", () => {
    expect(FeedCountsRequestSchema.parse({ postIds: [UUID_A, UUID_B] })).toEqual({
      postIds: [UUID_A, UUID_B],
    })
  })

  it("rejects an empty, oversized or unknown-keyed request", () => {
    expect(FeedCountsRequestSchema.safeParse({ postIds: [] }).success).toBe(false)
    expect(
      FeedCountsRequestSchema.safeParse({
        postIds: Array.from({ length: FEED_COUNTS_MAX_IDS + 1 }, () => UUID_A),
      }).success,
    ).toBe(false)
    expect(FeedCountsRequestSchema.safeParse({ postIds: [UUID_A], all: true }).success).toBe(false)
  })

  it("parses a counts-only response", () => {
    const parsed = FeedCountsResponseSchema.parse({
      items: [{ id: UUID_A, counts: { likes: 3, reposts: 1, replies: 2, saves: 0 } }],
    })
    expect(parsed.items[0]?.counts.likes).toBe(3)
  })

  it("allows an empty item list so unreadable ids can simply be absent", () => {
    expect(FeedCountsResponseSchema.parse({ items: [] }).items).toEqual([])
  })

  it("is registered as an authenticated POST on /feed/counts", () => {
    expect(endpoints.getFeedCounts.method).toBe("POST")
    expect(endpoints.getFeedCounts.path).toBe("/feed/counts")
    expect(endpoints.getFeedCounts.auth).toBe("required")
    expect(endpoints.getFeedCounts.csrf).toBe(false)
    expect(endpoints.getFeedCounts.version).toBe("v1")
  })

  it("leaves the home feed endpoint untouched", () => {
    expect(endpoints.homeFeed.method).toBe("GET")
    expect(endpoints.homeFeed.path).toBe("/feed/home")
    expect(endpoints.homeFeed.auth).toBe("optional")
  })
})

describe("SignalTopicSchema", () => {
  it("carries the six topics in order", () => {
    expect(SignalTopicSchema.options).toEqual([
      "notifications",
      "threads",
      "reports",
      "host",
      "feed",
      "feed_counts",
    ])
  })

  it("rejects an unknown topic", () => {
    expect(SignalTopicSchema.safeParse("feedcounts").success).toBe(false)
  })

  it("carries a post id in the existing scoping slot and nothing more", () => {
    expect(UserSignalSchema.parse({ topic: "feed", id: UUID_A })).toEqual({
      topic: "feed",
      id: UUID_A,
    })
    expect(UserSignalSchema.parse({ topic: "feed" })).toEqual({ topic: "feed" })
    expect(
      UserSignalSchema.safeParse({ topic: "feed_counts", id: UUID_A, counts: {} }).success,
    ).toBe(false)
  })

  it("round-trips as a server signal frame", () => {
    const frame = WsServerMessageSchema.parse({ type: "signal", topic: "feed_counts", id: UUID_A })
    expect(frame).toEqual({ type: "signal", topic: "feed_counts", id: UUID_A })
  })
})
