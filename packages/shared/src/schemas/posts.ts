import { z } from "zod"
import { IdSchema, PaginationQuerySchema, pageResponse } from "./common.js"
import { PostDTOSchema, PostKindSchema } from "./entities.js"

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
 * report), or media - so an empty post is rejected.
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

export const ListRepliesResponseSchema = FeedPageDTOSchema
export type ListRepliesResponse = z.infer<typeof ListRepliesResponseSchema>

export const ListUserPostsResponseSchema = FeedPageDTOSchema
export type ListUserPostsResponse = z.infer<typeof ListUserPostsResponseSchema>

export const ListSavesResponseSchema = FeedPageDTOSchema
export type ListSavesResponse = z.infer<typeof ListSavesResponseSchema>
