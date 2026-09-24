import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { PersonDTO, PostDTO, PostRefDTO } from "@civfix/shared"
import {
  buildPostCardModel,
  buildPostCardView,
  postMenuSubject,
  repostBodyText,
  repostSubjectAuthorId,
} from "../postCardModel"

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

describe("the overflow menu's subject is the post the row actually renders", () => {
  it("redirects a REPOST's menu to the original, and keeps a quote's on itself", () => {
    expect(postMenuSubject(repost(ref()))).toEqual({
      id: "post-original",
      authorId: "person-2",
      repost: { id: "post-repost", authorId: "person-1" },
    })

    const quote: PostDTO = { ...repost(ref()), kind: "quote", body: "Worth joining." }
    expect(postMenuSubject(quote)).toEqual({ id: "post-repost", authorId: "person-1", repost: null })

    const plain: PostDTO = { ...repost(ref()), kind: "post", repostOf: null }
    expect(postMenuSubject(plain)).toEqual({ id: "post-repost", authorId: "person-1", repost: null })
  })

  it("reports no author at all when the original's account is gone", () => {
    expect(postMenuSubject(repost(ref({ author: null })))).toEqual({
      id: "post-original",
      authorId: null,
      repost: { id: "post-repost", authorId: "person-1" },
    })
  })

  it("falls back to the WRAPPER when the original post itself is deleted", () => {
    const gone = repost(ref({ deleted: true, body: null, excerpt: "" }))
    expect(postMenuSubject(gone)).toEqual({ id: "post-repost", authorId: "person-1", repost: null })

    const goneAndAuthorless = repost(ref({ deleted: true, author: null, excerpt: "" }))
    expect(postMenuSubject(goneAndAuthorless)).toEqual({ id: "post-repost", authorId: "person-1", repost: null })
  })

  it("offers no jump to an original that is gone", () => {
    const view = (post: PostDTO) => buildPostCardView(post, buildPostCardModel(post, t))
    expect(view(repost(ref())).openableOriginalId).toBe("post-original")
    expect(view(repost(ref({ deleted: true, body: null, excerpt: "" }))).openableOriginalId).toBeNull()
    expect(view({ ...repost(ref()), kind: "quote", body: "Worth joining." }).openableOriginalId).toBeNull()
    const card = readFileSync(new URL("../PostCard.tsx", import.meta.url), "utf8")
    expect(card).toContain("(openableOriginalId ? () => openPost(openableOriginalId) : undefined)")
    const focal = readFileSync(new URL("../thread/ThreadFocalPost.tsx", import.meta.url), "utf8")
    expect(focal).toContain("isRepost && embedded && !embedded.deleted")
  })

  it("routes the row, comment and quote to the live original and falls back to the wrapper", () => {
    const view = (post: PostDTO) => buildPostCardView(post, buildPostCardModel(post, t))
    expect(view(repost(ref()))).toMatchObject({ isRepost: true, rowPostId: "post-original", actionTargetId: "post-original" })
    expect(view(repost(ref({ deleted: true, body: null, excerpt: "" })))).toMatchObject({
      rowPostId: "post-original",
      actionTargetId: "post-repost",
    })
    const plain: PostDTO = { ...repost(ref()), kind: "post", repostOf: null }
    expect(view(plain)).toMatchObject({ isRepost: false, rowPostId: "post-repost", actionTargetId: "post-repost" })
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

  it("gives the repost meta row the same overflow button the ordinary row has", () => {
    const metaRows = CARD.split("function ").filter((block) => block.startsWith("PostMetaRow("))
    expect(metaRows).toHaveLength(1)
    expect(metaRows[0]).toContain(
      '<PostOverflowButton label={t("post_card.more_a11y")} onPress={onOpenMenu} buttonRef={menuRef} expanded={menuOpen} />',
    )
    expect(CARD.split("<PostMetaRow").length - 1).toBe(1)
    expect(CARD).toMatch(
      /<PostMetaRow\s+variant=\{isRepost \? "repost" : "own"\}[\s\S]*?onOpenMenu=\{openMenu\}[\s\S]*?menuRef=\{menuTrigger\.ref\}/,
    )
  })

  it("hands the menu the redirected subject and a way back to the original", () => {
    expect(CARD).toContain("= usePostOverflowMenuState(post)")
    expect(src("../postCardActions.ts")).toContain("const menuSubject = React.useMemo(() => postMenuSubject(post), [post])")
    expect(CARD).toMatch(/<PostOverflowMenu[\s\S]*?subject=\{menuSubject\}/)
    expect(CARD).toMatch(/<PostOverflowMenu[\s\S]*?onOpenOriginal=\{openOriginal\}/)
    expect(CARD).toContain("(openableOriginalId ? () => openPost(openableOriginalId) : undefined)")
    const MENU = src("../PostOverflowMenu.tsx")
    expect(MENU).toContain('label: t("post_card.menu.go_to_original")')
    expect(MENU).toContain("...(onOpenOriginal")
  })

  it("renders the original's media, event and report inline instead of gating them out", () => {
    const photo = { id: "m1", kind: "image" as const, url: "https://cdn/1.jpg", status: "ready" as const }
    const event = { id: "event-1" } as NonNullable<PostRefDTO["event"]>
    const report = { id: "report-1" } as NonNullable<PostRefDTO["report"]>
    const shared = repost(ref({ media: [photo], event, report }))
    const view = buildPostCardView(shared, buildPostCardModel(shared, t))
    expect(view.media).toEqual([photo])
    expect(view.displayEvent).toBe(event)
    expect(view.displayReport).toBe(report)

    const own: PostDTO = { ...shared, kind: "post", repostOf: null, media: [], event: null, report: null }
    const ownView = buildPostCardView(own, buildPostCardModel(own, t))
    expect(ownView.media).toEqual([])
    expect(ownView.displayEvent).toBeNull()
    expect(ownView.displayReport).toBeNull()

    expect(CARD).toContain("const { isRepost, embedded, media, displayEvent, displayReport } = view")
    expect(CARD).toContain('{t("post_card.unavailable")}')
  })
})
