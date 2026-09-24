import { describe, expect, it } from "vitest"
import type { OrganizationDTO, PersonDTO } from "@civfix/shared"
import {
  POST_MENTION_CAP,
  buildOptimisticPost,
  postSubmitDestination,
  resolvePostSubmit,
  toPostOrganizationRef,
  type PostDraft,
} from "../postComposerSubmit"
import type { PostComposerMedia } from "../postComposerStore"

function draft(overrides: Partial<PostDraft> = {}): PostDraft {
  return { body: "", ...overrides }
}

describe("resolvePostSubmit", () => {
  it("blocks an entirely empty draft (no body, no attachment, no media)", () => {
    expect(resolvePostSubmit(draft())).toEqual({ action: "blocked-empty" })
    // Whitespace-only body is still empty.
    expect(resolvePostSubmit(draft({ body: "   " }))).toEqual({ action: "blocked-empty" })
  })

  it("blocks while staged media is still uploading (media-pending)", () => {
    const res = resolvePostSubmit(draft({ mediaCount: 1 }), /* hasReadyMedia */ false)
    expect(res).toEqual({ action: "blocked-media-pending" })
  })

  it("submits a text-only post, trimming the body", () => {
    const res = resolvePostSubmit(draft({ body: "  hello river  " }))
    expect(res.action).toBe("submit")
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input).toMatchObject({ kind: "post", body: "hello river", mediaUploadIds: [], mentionedUserIds: [] })
  })

  it("submits an event-only post (no body) via the attachment", () => {
    const res = resolvePostSubmit(draft({ eventId: "evt_1" }))
    expect(res.action).toBe("submit")
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input).toMatchObject({ kind: "post", eventId: "evt_1" })
    expect(res.input.body).toBeUndefined()
  })

  it("submits once staged media has finished uploading, carrying the finalized ids", () => {
    const res = resolvePostSubmit(
      draft({ mediaCount: 2, mediaUploadIds: ["m1", "m2"] }),
      /* hasReadyMedia */ true,
    )
    expect(res.action).toBe("submit")
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input.mediaUploadIds).toEqual(["m1", "m2"])
  })

  it("carries the chosen organization so the post publishes as that org", () => {
    const res = resolvePostSubmit(draft({ body: "trail day", organizationId: "org_1" }))
    expect(res.action).toBe("submit")
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input.organizationId).toBe("org_1")
  })

  it("omits the organization when posting as the acting person", () => {
    for (const organizationId of [null, undefined]) {
      const res = resolvePostSubmit(draft({ body: "trail day", organizationId }))
      if (res.action !== "submit") throw new Error("expected submit")
      expect("organizationId" in res.input).toBe(false)
    }
  })

  it("never sends an organization on a repost, which the contract rejects", () => {
    const res = resolvePostSubmit(
      draft({ body: "trail day", kind: "repost", repostOfId: "post_1", organizationId: "org_1" }),
    )
    if (res.action !== "submit") throw new Error("expected submit")
    expect("organizationId" in res.input).toBe(false)
  })

  it("carries the reference fields for a reply", () => {
    const res = resolvePostSubmit(draft({ body: "count me in", kind: "reply", replyToId: "post_1" }))
    expect(res.action).toBe("submit")
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input).toMatchObject({ kind: "reply", replyToId: "post_1", body: "count me in" })
  })

})

describe("postSubmitDestination", () => {
  it("returns a top-level post to where the author came from", () => {
    expect(postSubmitDestination("post")).toBe("origin")
  })

  it("drills a quote or a reply into the thread it just started", () => {
    expect(postSubmitDestination("quote")).toBe("thread")
    expect(postSubmitDestination("reply")).toBe("thread")
    expect(postSubmitDestination("repost")).toBe("thread")
  })
})

describe("resolvePostSubmit keeps mentions inside the contract", () => {
  it("sends at most POST_MENTION_CAP ids, so a busy body still publishes instead of failing validation", () => {
    const ids = Array.from({ length: 25 }, (_, index) => `user-${index}`)
    const res = resolvePostSubmit(draft({ body: "hi all", mentionedUserIds: ids }))
    if (res.action !== "submit") throw new Error("expected submit")
    expect(POST_MENTION_CAP).toBe(20)
    expect(res.input.mentionedUserIds).toEqual(ids.slice(0, 20))
  })

  it("does not spend the cap on duplicates", () => {
    const res = resolvePostSubmit(draft({ body: "hi", mentionedUserIds: ["a", "a", "b"] }))
    if (res.action !== "submit") throw new Error("expected submit")
    expect(res.input.mentionedUserIds).toEqual(["a", "b"])
  })
})

describe("toPostOrganizationRef", () => {
  const org = {
    id: "org-1",
    slug: "river-crew",
    name: "River Crew",
    logoUrl: undefined,
    verifiedStatus: "verified",
    verifiedKind: "government",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as OrganizationDTO

  it("projects the byline fields, nulling a missing logo and reading verification from the status", () => {
    expect(toPostOrganizationRef(org)).toEqual({
      id: "org-1",
      slug: "river-crew",
      name: "River Crew",
      logoUrl: null,
      verified: true,
      verifiedKind: "government",
    })
  })

  it("leaves verifiedKind off an unverified org rather than writing a null", () => {
    const ref = toPostOrganizationRef({ ...org, verifiedStatus: "pending", verifiedKind: null } as OrganizationDTO)
    expect(ref.verified).toBe(false)
    expect(ref).not.toHaveProperty("verifiedKind")
  })
})

describe("buildOptimisticPost", () => {
  const NOW = new Date("2026-09-24T10:00:00.000Z")
  const author = { id: "me", name: "Me" } as unknown as PersonDTO
  const media = (uploadId: string | null): PostComposerMedia => ({
    uri: `file://${uploadId ?? "pending"}.jpg`,
    kind: "image",
    posterUri: null,
    uploadId,
    status: uploadId ? "ready" : "uploading",
  })

  it("is a zero-count post stamped with one clock read", () => {
    const post = buildOptimisticPost({ author, kind: "post", body: "hi", now: NOW })
    expect(post).toEqual({
      id: `optimistic-${NOW.getTime()}`,
      author,
      kind: "post",
      body: "hi",
      createdAt: NOW.toISOString(),
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
    })
  })

  it("sets the organization key only when the surface passes one, null included", () => {
    expect(buildOptimisticPost({ author, kind: "post", body: null, now: NOW })).not.toHaveProperty("organization")
    expect(buildOptimisticPost({ author, kind: "post", body: null, now: NOW, organization: null }).organization).toBeNull()
  })

  it("renders only finalized uploads, as ready media keyed by their upload id", () => {
    const post = buildOptimisticPost({ author, kind: "post", body: null, now: NOW, media: [media("u1"), media(null)] })
    expect(post.media).toEqual([
      { id: "u1", kind: "image", url: "file://u1.jpg", thumbUrl: null, status: "ready" },
    ])
  })

  it("carries the reply linkage it is given", () => {
    const post = buildOptimisticPost({ author, kind: "reply", body: "yes", now: NOW, replyToId: "p1", threadRootId: "root" })
    expect(post).toMatchObject({ kind: "reply", replyToId: "p1", threadRootId: "root" })
  })
})
