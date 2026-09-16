import { z } from "zod"
import { IdSchema, PaginationQuerySchema, pageResponse } from "./common.js"
import { PostCountsSchema, PostDTOSchema, PostKindSchema, type PostDTO } from "./entities.js"

/**
 * Social-feed post request/response contracts. The PostDTO + PostKind primitives live in
 * ./entities.js (S1) so the recursive repost/reply preview cycle stays contained there; this file
 * builds the compose input (with cross-field refinements) and the per-endpoint envelopes on top,
 * plus the single cursor-paged FeedPageDTO reused by every list surface (home feed, replies, a
 * person's posts, saved posts).
 */

/**
 * Body of POST /posts. Also carries a QUOTE (kind:"quote" + repostOfId + body) and a REPLY
 * (kind:"reply" + replyToId). A PURE repost is NOT this route - it is the toggle POST
 * /posts/:id/repost. superRefine enforces the cross-field rules: a quote requires repostOfId; a
 * reply requires replyToId; and every post must carry SOMETHING - a body, an attachment (event or
 * report), or media - so an empty post is rejected, and organizationId is refused on a repost.
 */
export const PostComposeInputSchema = z
  .object({
    kind: PostKindSchema.default("post"), // "post" | "quote" | "reply" (repost uses its own route)
    body: z.string().trim().max(2000).optional(), // required unless an attachment/media carries the post
    replyToId: IdSchema.optional(), // set for kind:"reply"
    repostOfId: IdSchema.optional(), // set for kind:"quote"
    eventId: IdSchema.optional(), // attach an event the author is attending/hosting
    reportId: IdSchema.optional(), // attach a report
    mediaUploadIds: z.array(IdSchema).max(4).default([]), // finalized upload ids to claim as post media
    mentionedUserIds: z.array(IdSchema).max(20).default([]),
    organizationId: IdSchema.optional(), // post AS this organization (DECISIONS §34); not valid on a repost
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

export const DeletePostResponseSchema = z.object({ ok: z.literal(true) })
export type DeletePostResponse = z.infer<typeof DeletePostResponseSchema>

/** Like/unlike returns the full patched post (viewer flags + counts). */
export const LikePostResponseSchema = PostDTOSchema
export type LikePostResponse = z.infer<typeof LikePostResponseSchema>

/** Save/unsave returns the full patched post (viewer flags + counts). */
export const SavePostResponseSchema = PostDTOSchema
export type SavePostResponse = z.infer<typeof SavePostResponseSchema>

/** Repost/unrepost returns the created/removed repost's TARGET post, patched. */
export const RepostResponseSchema = PostDTOSchema
export type RepostResponse = z.infer<typeof RepostResponseSchema>

/** { items: PostDTO[], nextCursor: string | null } - the shared shape for every post list. */
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
    nearbyWeight: z.number().min(0).max(1000).default(50),
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
 * A thread's direct replies, plus `authorReplies`: for each listed reply that the FOCAL POST'S AUTHOR has
 * answered, their single most recent answer to it. The thread screen renders one of those under its parent
 * as a connected row - the only nesting the conversation shows. Everything deeper lives on that reply's own
 * thread. Empty on an older server, so the field is defaulted, never required.
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
