import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { PersonDTO, PostDTO, PostRefDTO } from "@civfix/shared"
import { buildPostCardModel, repostBodyText, repostSubjectAuthorId } from "../postCardModel"

const EN: Record<string, string> = {
  "post_card.repost_attribution": "{{name}} reposted",
  "post_card.unavailable": "This post is no longer available.",
}

const t = ((key: string, vars?: Record<string, unknown>) => {
  const template = EN[key] ?? key
  return template.replace(/{{(\w+)}}/g, (_, name: string) => String(vars?.[name] ?? ""))
}) as unknown as TFunction

const person = (id: string, name: string): PersonDTO => ({
  id,
  name,
  handle: name.toLocaleLowerCase().replace(/\W/g, ""),
  bio: null,
  avatar: ["#111111", "#222222"],
  followers: 0,
  following: 0,
  isFollowing: false,
})

const ref = (over: Partial<PostRefDTO> = {}): PostRefDTO => ({
  id: "post-original",
  author: person("person-2", "Maria G"),
  kind: "post",
  excerpt: "We still need ten volunteers",
  createdAt: "2026-07-19T12:00:00.000Z",
  media: [],
  ...over,
})

const repost = (embedded: PostRefDTO): PostDTO => ({
  id: "post-repost",
  author: person("person-1", "Friends of Ballona"),
  kind: "repost",
  body: null,
  createdAt: "2026-07-20T12:00:00.000Z",
  editedAt: null,
  counts: { likes: 2, reposts: 1, replies: 0, saves: 0 },
  viewer: { liked: false, reposted: true, saved: false },
  media: [],
  mentions: [],
  event: null,
  report: null,
  repostOf: embedded,
  replyToId: null,
  threadRootId: null,
})

describe("a repost renders its ORIGINAL, not a truncated preview of it", () => {
  it("prefers the original's full body and falls back to the excerpt an older server sends", () => {
    expect(repostBodyText(ref({ body: "We still need ten volunteers, and a truck." }))).toBe(
      "We still need ten volunteers, and a truck.",
    )
    expect(repostBodyText(ref())).toBe("We still need ten volunteers")
    expect(repostBodyText(ref({ deleted: true, body: null, excerpt: "" }))).toBe("")
  })

  it("models the repost off the ORIGINAL's body, so a long original still clamps", () => {
    const long = "x".repeat(600)
    const model = buildPostCardModel(repost(ref({ body: long })), t)

    expect(model.variant).toBe("repost")
    expect(model.repostAttribution).toBe("Friends of Ballona reposted")
    expect(model.bodyExpandable).toBe(true)
    expect(model.embeddedPost?.body).toBe(long)
  })

  it("attributes the repost's interactions to the ORIGINAL's author, never the booster", () => {
    expect(repostSubjectAuthorId(repost(ref()))).toBe("person-2")
    expect(repostSubjectAuthorId({ ...repost(ref()), kind: "post", repostOf: null })).toBe("person-1")
    expect(repostSubjectAuthorId(repost(ref({ author: null })))).toBe("person-1")
  })
})

describe("the repost surfaces wire the guard and the embed they are modelled on", () => {
  const src = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8")
  const CARD = src("../PostCard.tsx")
  const BAR = src("../../primitives/PostActionBar.tsx")

  it("hands the action bar the ORIGINAL's author so a self-repost cannot be offered", () => {
    expect(CARD).toContain("authorId={repostSubjectAuthorId(post)}")
    expect(BAR).toContain("const isOwnPost = authorId != null && viewerId != null && authorId === viewerId")
    expect(BAR).toMatch(/onRepost: isOwnPost\s*\?\s*undefined/)
  })

  it("renders the original's media, event and report inline instead of gating them out", () => {
    expect(CARD).toContain("const media = isRepost && embedded ? embedded.media ?? EMPTY_MEDIA : post.media ?? EMPTY_MEDIA")
    expect(CARD).toContain("const displayEvent = isRepost ? (embedded?.event ?? null) : (post.event ?? null)")
    expect(CARD).toContain("const displayReport = isRepost ? (embedded?.report ?? null) : (post.report ?? null)")
    expect(CARD).toContain('{t("post_card.unavailable")}')
  })
})
