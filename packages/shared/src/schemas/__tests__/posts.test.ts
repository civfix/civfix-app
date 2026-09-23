import { describe, it, expect } from "vitest"
import {
  PostKindSchema,
  POST_KIND_VALUES,
  PostDTOSchema,
  PostRefDTOSchema,
} from "../entities.js"
import {
  PostComposeInputSchema,
  FeedPageDTOSchema,
  HomeFeedQuerySchema,
  PostRepliesQuerySchema,
  UserPostsQuerySchema,
} from "../posts.js"
import { MediaPurposeSchema } from "../common.js"
import { endpoints } from "../../client/endpoints.js"

/**
 * Social-feed contract (P0): the PostDTO round-trips; the PostComposeInput cross-field refinements
 * hold (quote⇒repostOfId, reply⇒replyToId, and a post must carry a body/attachment/media); the
 * shared FeedPageDTO shape; and the 13 post endpoints are wired into the registry.
 */

const UUID_A = "11111111-1111-1111-1111-111111111111"
const UUID_B = "22222222-2222-2222-2222-222222222222"
const UUID_C = "33333333-3333-3333-3333-333333333333"

const person = {
  id: UUID_B,
  name: "Roman Aytur",
  handle: "roman",
  followers: 12,
  following: 8,
  isFollowing: false,
}

const basePost = {
  id: UUID_A,
  author: person,
  kind: "post",
  body: "Cleaning up Echo Park this Saturday!",
  createdAt: "2026-07-20T10:00:00.000Z",
  counts: { likes: 3, reposts: 1, replies: 0, saves: 2 },
  viewer: { liked: false, reposted: false, saved: true },
}

describe("PostKindSchema", () => {
  it("has exactly the four kinds in order", () => {
    expect(POST_KIND_VALUES).toEqual(["post", "repost", "quote", "reply"])
  })
  it("rejects unknown kinds", () => {
    expect(PostKindSchema.safeParse("bogus").success).toBe(false)
  })
})

describe("PostDTOSchema round-trip", () => {
  it("parses a valid post and defaults media/mentions to []", () => {
    const parsed = PostDTOSchema.parse(basePost)
    expect(parsed.id).toBe(UUID_A)
    expect(parsed.author.id).toBe(UUID_B)
    expect(parsed.kind).toBe("post")
    expect(parsed.counts).toEqual({ likes: 3, reposts: 1, replies: 0, saves: 2 })
    expect(parsed.viewer.saved).toBe(true)
    expect(parsed.media).toEqual([])
    expect(parsed.mentions).toEqual([])
  })

  it("accepts a repostOf PostRef preview with a null author (deleted)", () => {
    const ref = {
      id: UUID_C,
      author: null,
      kind: "post",
      excerpt: "original post text",
      createdAt: "2026-07-19T10:00:00.000Z",
      deleted: true,
    }
    expect(PostRefDTOSchema.safeParse(ref).success).toBe(true)
    const parsed = PostDTOSchema.parse({ ...basePost, kind: "quote", repostOf: ref })
    expect(parsed.repostOf?.author).toBeNull()
  })

  it("rejects a post missing required counts/viewer", () => {
    const { counts: _c, ...noCounts } = basePost
    expect(PostDTOSchema.safeParse(noCounts).success).toBe(false)
  })
})

describe("PostComposeInputSchema refinements", () => {
  it("passes a text-only post (kind defaults to 'post')", () => {
    const res = PostComposeInputSchema.safeParse({ body: "hello neighbors" })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.kind).toBe("post")
      expect(res.data.mediaUploadIds).toEqual([])
      expect(res.data.mentionedUserIds).toEqual([])
    }
  })

  it("passes a post with only an attached event (no body)", () => {
    expect(PostComposeInputSchema.safeParse({ eventId: UUID_C }).success).toBe(true)
  })

  it("fails an empty post (no body, no attachment, no media)", () => {
    const res = PostComposeInputSchema.safeParse({})
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join(".") === "body")).toBe(true)
    }
  })

  it("fails a whitespace-only body with no attachment/media", () => {
    expect(PostComposeInputSchema.safeParse({ body: "   " }).success).toBe(false)
  })

  it("fails a quote with no repostOfId", () => {
    const res = PostComposeInputSchema.safeParse({ kind: "quote", body: "adding my take" })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join(".") === "repostOfId")).toBe(true)
    }
  })

  it("passes a quote with repostOfId + body", () => {
    expect(
      PostComposeInputSchema.safeParse({ kind: "quote", repostOfId: UUID_C, body: "my take" })
        .success,
    ).toBe(true)
  })

  it("fails a reply with no replyToId", () => {
    const res = PostComposeInputSchema.safeParse({ kind: "reply", body: "great work" })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join(".") === "replyToId")).toBe(true)
    }
  })

  it("passes a reply with replyToId + body", () => {
    expect(
      PostComposeInputSchema.safeParse({ kind: "reply", replyToId: UUID_A, body: "great work" })
        .success,
    ).toBe(true)
  })

  it("rejects unknown keys (strict)", () => {
    expect(PostComposeInputSchema.safeParse({ body: "hi", bogus: 1 }).success).toBe(false)
  })
})

describe("FeedPageDTOSchema + HomeFeedQuerySchema", () => {
  it("parses a page of posts with a nullable cursor", () => {
    const page = FeedPageDTOSchema.parse({ items: [basePost], nextCursor: null })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.id).toBe(UUID_A)
    expect(page.nextCursor).toBeNull()
  })

  it("defaults the home-feed filter to 'all'", () => {
    const q = HomeFeedQuerySchema.parse({})
    expect(q.filter).toBe("all")
  })

  it("rejects an unknown home-feed filter", () => {
    expect(HomeFeedQuerySchema.safeParse({ filter: "photos" }).success).toBe(false)
  })

  it("accepts post media and requires path ids for paginated post routes", () => {
    expect(MediaPurposeSchema.parse("post")).toBe("post")
    expect(PostRepliesQuerySchema.parse({ id: UUID_A, cursor: "next" })).toEqual({
      id: UUID_A,
      cursor: "next",
    })
    expect(UserPostsQuerySchema.safeParse({ cursor: "next" }).success).toBe(false)
  })
})

describe("post endpoint registry", () => {
  // [endpoint, method, path, csrf, auth]. The home feed is OPTIONAL auth so a signed-out reader can read
  // the public/global feed; every write + the personal lists stay required. listUserPosts is OPTIONAL for
  // the same reason: getProfile is already "optional", so a signed-out profile page would otherwise render
  // a readable header next to a 401'd posts tab.
  const specs = [
    [endpoints.createPost, "POST", "/posts", true, "required"],
    [endpoints.getPost, "GET", "/posts/:id", false, "optional"],
    [endpoints.deletePost, "DELETE", "/posts/:id", true, "required"],
    [endpoints.listReplies, "GET", "/posts/:id/replies", false, "required"],
    [endpoints.repostPost, "POST", "/posts/:id/repost", true, "required"],
    [endpoints.unrepostPost, "DELETE", "/posts/:id/repost", true, "required"],
    [endpoints.likePost, "POST", "/posts/:id/like", true, "required"],
    [endpoints.unlikePost, "DELETE", "/posts/:id/like", true, "required"],
    [endpoints.savePost, "POST", "/posts/:id/save", true, "required"],
    [endpoints.unsavePost, "DELETE", "/posts/:id/save", true, "required"],
    [endpoints.homeFeed, "GET", "/feed/home", false, "optional"],
    [endpoints.listUserPosts, "GET", "/people/:id/posts", false, "optional"],
    [endpoints.listSaves, "GET", "/me/saves", false, "required"],
  ] as const

  it("registers all 13 post endpoints with the right method/path/auth/csrf", () => {
    expect(specs).toHaveLength(13)
    for (const [ep, method, path, csrf, auth] of specs) {
      expect(ep.method).toBe(method)
      expect(ep.path).toBe(path)
      expect(ep.auth).toBe(auth)
      expect(ep.csrf).toBe(csrf)
      expect(ep.version).toBe("v1")
    }
  })
})
