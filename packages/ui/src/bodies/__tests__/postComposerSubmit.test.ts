import { describe, expect, it } from "vitest"
import {
  POST_MENTION_CAP,
  postSubmitDestination,
  resolvePostSubmit,
  type PostDraft,
} from "../postComposerSubmit"

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
