import { z } from "zod"
import { IdSchema, PaginationQuerySchema, pageResponse } from "./common.js"
import { PostCountsSchema, PostDTOSchema, PostKindSchema, type PostDTO } from "./entities.js"
import { MAX_MENTIONED_USERS, OkResponseSchema } from "./internal-fields.js"

/*
 * PostDTO and PostKind live in ./entities.js so the recursive repost/reply preview cycle stays
 * contained there.
 */

/**
 * Body of POST /posts, which also carries quotes and replies. A pure repost is not this route: it is
 * the toggle POST /posts/:id/repost. A quote requires repostOfId, a reply requires replyToId, every
 * post needs a body, an attachment or media, and organizationId is refused on a repost.
 */
export const PostComposeInputSchema = z
  .object({
    kind: PostKindSchema.default("post"),
    body: z.string().trim().max(2000).optional(),
    replyToId: IdSchema.optional(),
    repostOfId: IdSchema.optional(),
    eventId: IdSchema.optional(), // the server refuses an event the author neither hosts nor attends
    reportId: IdSchema.optional(),
    mediaUploadIds: z.array(IdSchema).max(4).default([]),
    mentionedUserIds: z.array(IdSchema).max(MAX_MENTIONED_USERS).default([]),
    organizationId: IdSchema.optional(), // post as this organization (DECISIONS §34)
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.kind === "quote" && !v.repostOfId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A quote post requires repostOfId (the quoted post).",
        path: ["repostOfId"],
      })
    }
    if (v.kind === "reply" && !v.replyToId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reply requires replyToId (the parent post).",
        path: ["replyToId"],
      })
    }
    if (v.kind === "repost" && v.organizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A repost cannot be attributed to an organization.",
        path: ["organizationId"],
      })
    }
    const hasBody = typeof v.body === "string" && v.body.length > 0
    const hasAttachment = Boolean(v.eventId) || Boolean(v.reportId)
    const hasMedia = v.mediaUploadIds.length > 0
    if (!hasBody && !hasAttachment && !hasMedia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A post must have a body, an attached event/report, or media.",
        path: ["body"],
      })
    }
  })
export type PostComposeInput = z.infer<typeof PostComposeInputSchema>

export const CreatePostResponseSchema = PostDTOSchema
export type CreatePostResponse = z.infer<typeof CreatePostResponseSchema>

export const GetPostResponseSchema = PostDTOSchema
export type GetPostResponse = z.infer<typeof GetPostResponseSchema>

export const DeletePostResponseSchema = OkResponseSchema
export type DeletePostResponse = z.infer<typeof DeletePostResponseSchema>

/** Like/unlike returns the full patched post (viewer flags + counts). */
export const LikePostResponseSchema = PostDTOSchema
export type LikePostResponse = z.infer<typeof LikePostResponseSchema>

/** Save/unsave returns the full patched post (viewer flags + counts). */
export const SavePostResponseSchema = PostDTOSchema
export type SavePostResponse = z.infer<typeof SavePostResponseSchema>

/** Repost/unrepost returns the repost's target post, patched. */
export const RepostResponseSchema = PostDTOSchema
export type RepostResponse = z.infer<typeof RepostResponseSchema>

/** The shared page shape for every post list. */
export const FeedPageDTOSchema = pageResponse(PostDTOSchema)
export type FeedPageDTO = z.infer<typeof FeedPageDTOSchema>

export const HomeFeedQuerySchema = PaginationQuerySchema.extend({
  filter: z.enum(["all", "events", "fixes"]).default("all"),
}).strict()
export type HomeFeedQuery = z.infer<typeof HomeFeedQuerySchema>

/** Typed-client input for paginated routes whose resource id is interpolated into the path. */
export const PostRepliesQuerySchema = PaginationQuerySchema.extend({ id: IdSchema }).strict()
export type PostRepliesQuery = z.infer<typeof PostRepliesQuerySchema>

export const UserPostsQuerySchema = PaginationQuerySchema.extend({ id: IdSchema }).strict()
export type UserPostsQuery = z.infer<typeof UserPostsQuerySchema>

export const HomeFeedResponseSchema = FeedPageDTOSchema
export type HomeFeedResponse = z.infer<typeof HomeFeedResponseSchema>

export const FEED_SCORE_CURSOR_PRECISION = 6

export const FeedScoreCursorSchema = z
  .object({
    score: z.number().finite().nonnegative(),
    postId: IdSchema,
  })
  .strict()
export type FeedScoreCursor = z.infer<typeof FeedScoreCursorSchema>

const FEED_SCORE_CURSOR_RE = /^(\d+(?:\.\d+)?)\|([0-9a-fA-F-]{36})$/

export function quantizeFeedScore(score: number): number {
  const factor = 10 ** FEED_SCORE_CURSOR_PRECISION
  return Math.round(score * factor) / factor
}

export function formatFeedScoreCursor(cursor: FeedScoreCursor): string {
  const { score, postId } = FeedScoreCursorSchema.parse(cursor)
  return `${quantizeFeedScore(score).toFixed(FEED_SCORE_CURSOR_PRECISION)}|${postId}`
}

export function parseFeedScoreCursor(cursor: string | null | undefined): FeedScoreCursor | null {
  if (typeof cursor !== "string") return null
  const match = FEED_SCORE_CURSOR_RE.exec(cursor.trim())
  if (!match) return null
  const parsed = FeedScoreCursorSchema.safeParse({
    score: Number(match[1]),
    postId: match[2],
  })
  return parsed.success ? parsed.data : null
}

export function isAfterFeedScoreCursor(
  candidate: FeedScoreCursor,
  cursor: FeedScoreCursor,
): boolean {
  const score = quantizeFeedScore(candidate.score)
  const cursorScore = quantizeFeedScore(cursor.score)
  if (score !== cursorScore) return score < cursorScore
  return candidate.postId < cursor.postId
}

export const FeedRankingConfigSchema = z
  .object({
    baseWeight: z.number().min(0).max(1000).default(10),
    followWeight: z.number().min(0).max(1000).default(100),
    selfWeight: z.number().min(0).max(1000).default(60),
    mentionWeight: z.number().min(0).max(1000).default(40),
    nearbyWeight: z.number().min(0).max(1000).default(300),
    nearbyRadiusKm: z.number().positive().max(500).default(40),
    orgVerifiedWeight: z.number().min(0).max(1000).default(30),
    attachEventWeight: z.number().min(0).max(1000).default(30),
    attachReportWeight: z.number().min(0).max(1000).default(30),
    imageWeight: z.number().min(0).max(1000).default(5),
    likeWeight: z.number().min(0).max(1000).default(3),
    replyWeight: z.number().min(0).max(1000).default(8),
    repostWeight: z.number().min(0).max(1000).default(5),
    halfLifeHours: z.number().positive().max(8760).default(36),
    decayFloor: z.number().min(0).max(1).default(0.15),
    diversityFloor: z.number().min(0).max(1).default(0.25),
    diversityDecay: z.number().min(0).max(1).default(0.5),
    seenDiscount: z.number().min(0).max(1).default(0.7),
    jitterAmount: z.number().min(0).max(1).default(0.15),
    minScore: z.number().min(0).max(1000).default(12),
    minPageItems: z.number().int().min(0).max(50).default(5),
    candidateWindowDays: z.number().int().positive().max(365).default(30),
    candidateCap: z.number().int().min(50).max(2000).default(400),
    clockBucketSeconds: z.number().int().min(1).max(3600).default(60),
    snapshotTtlSeconds: z.number().int().min(0).max(3600).default(180),
    servedTtlSeconds: z.number().int().min(60).max(86400).default(900),
    viewerFanoutMax: z.number().int().min(0).max(10000).default(500),
    newPostFanoutMax: z.number().int().min(0).max(100000).default(1000),
  })
  .strict()
export type FeedRankingConfig = z.infer<typeof FeedRankingConfigSchema>

export const DEFAULT_FEED_RANKING: FeedRankingConfig = FeedRankingConfigSchema.parse({})

export const FEED_COUNTS_MAX_IDS = 100

export const FeedCountsRequestSchema = z
  .object({ postIds: z.array(IdSchema).min(1).max(FEED_COUNTS_MAX_IDS) })
  .strict()
export type FeedCountsRequest = z.infer<typeof FeedCountsRequestSchema>

export const FeedPostCountsDTOSchema = z.object({ id: IdSchema, counts: PostCountsSchema })
export type FeedPostCountsDTO = z.infer<typeof FeedPostCountsDTOSchema>

export const FeedCountsResponseSchema = z
  .object({ items: z.array(FeedPostCountsDTOSchema) })
  .strict()
export type FeedCountsResponse = z.infer<typeof FeedCountsResponseSchema>

/**
 * A thread's direct replies, plus `authorReplies`: for each listed reply the focal post's author has
 * answered, their most recent answer to it. That is the only nesting a thread shows; everything deeper
 * lives on the reply's own thread. Defaulted, never required, because an older server omits it.
 */
export interface ListRepliesResponse extends FeedPageDTO {
  authorReplies: PostDTO[]
}
export const ListRepliesResponseSchema: z.ZodType<ListRepliesResponse, z.ZodTypeDef, unknown> =
  FeedPageDTOSchema.extend({ authorReplies: z.array(PostDTOSchema).default([]) })

export const ListUserPostsResponseSchema = FeedPageDTOSchema
export type ListUserPostsResponse = z.infer<typeof ListUserPostsResponseSchema>

export const ListSavesResponseSchema = FeedPageDTOSchema
export type ListSavesResponse = z.infer<typeof ListSavesResponseSchema>
