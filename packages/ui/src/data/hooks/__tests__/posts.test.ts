/**
 * The post hooks' optimistic caching, driven through the same `useMutation` options the hooks build
 * (`buildToggleMutation` / `buildCreateMutation` / `buildDeleteMutation`) against a real QueryClient,
 * because this package has no React renderer.
 */
import { describe, expect, it } from "vitest"
import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import type { PersonDTO, PostDTO, FeedPageDTO, PostComposeInput } from "@civfix/shared"
import { queryKeys } from "../../keys"
import {
  buildToggleMutation,
  buildCreateMutation,
  buildDeleteMutation,
  homeFeedPlaceholder,
  type CreateCtx,
  type CreatePostVars,
} from "../posts"

/**
 * react-query's option callbacks carry extra trailing params (mutation / context) in their full type.
 * The tests exercise only the cache-patch BEHAVIOR, so the built options are viewed through this loose
 * alias to invoke onMutate/onError/onSuccess directly.
 */
interface Loose<V, R, C = unknown> {
  onMutate: (v: V) => Promise<C>
  onError: (e: unknown, v: V, c: unknown) => void
  onSuccess: (r: R, v: V, c: unknown) => void
  onSettled: (r: R | undefined, e: unknown, v: V) => void
}
function loose<V, R, C = unknown>(opts: unknown): Loose<V, R, C> {
  return opts as Loose<V, R, C>
}

function person(id: string): PersonDTO {
  return {
    id,
    name: `User ${id}`,
    handle: id,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

function post(id: string, overrides: Partial<PostDTO> = {}): PostDTO {
  return {
    id,
    author: person("me"),
    kind: "post",
    body: `body ${id}`,
    createdAt: "2026-07-20T00:00:00.000Z",
    counts: { likes: 5, reposts: 2, replies: 1, saves: 0 },
    viewer: { liked: false, reposted: false, saved: false },
    media: [],
    mentions: [],
    event: null,
    report: null,
    repostOf: null,
    replyToId: null,
    threadRootId: null,
    ...overrides,
  }
}

function feed(items: PostDTO[]): InfiniteData<FeedPageDTO> {
  return { pages: [{ items, nextCursor: null }], pageParams: [undefined] }
}

/** Read a post (by id) out of an infinite feed cache. */
function itemIn(qc: QueryClient, key: readonly unknown[], id: string): PostDTO | undefined {
  return qc
    .getQueryData<InfiniteData<FeedPageDTO>>(key)
    ?.pages.flatMap((p) => p.items)
    .find((p) => p.id === id)
}

/**
 * The REAL runtime home-feed key an authenticated `useHomeFeed("all")` builds - auth scope included.
 * Seeding a hand-built 3-segment key here would mask a drift between the key `useHomeFeed` reads and the
 * one `buildCreateMutation` writes: `setQueryData` is EXACT-match, so a mismatch makes the optimistic
 * prepend / swap / rollback silent no-ops in the app while the test still passes.
 */
const FEED_ALL = queryKeys.homeFeed("all", "me")

/**
 * The query keys a mutation's `onSettled` invalidated. `invalidateQueries` is spied rather than asserted
 * through the cache because an invalidation of an unfetched key leaves no observable cache trace.
 */
function invalidated(qc: QueryClient): readonly unknown[][] {
  return (qc as unknown as { __invalidated?: unknown[][] }).__invalidated ?? []
}

/** Record every `invalidateQueries` call on a client so `invalidated()` can read them back. */
function recordInvalidations(qc: QueryClient): QueryClient {
  const seen: unknown[][] = []
  ;(qc as unknown as { __invalidated: unknown[][] }).__invalidated = seen
  const original = qc.invalidateQueries.bind(qc)
  qc.invalidateQueries = ((filters?: { queryKey?: unknown[] }) => {
    if (filters?.queryKey) seen.push(filters.queryKey)
    return original(filters as never)
  }) as typeof qc.invalidateQueries
  return qc
}

describe("useLikePost optimism (buildToggleMutation)", () => {
  it("flips viewer.liked + counts.likes across the feed AND the single post detail, then reconciles", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A"), post("B")]))
    qc.setQueryData(queryKeys.post("A"), post("A"))

    const server = post("A", { viewer: { liked: true, reposted: false, saved: false }, counts: { likes: 9, reposts: 2, replies: 1, saves: 0 } })
    const opts = loose<boolean, PostDTO>(buildToggleMutation(qc, "A", "liked", async () => server))
    const ctx = await opts.onMutate(false) // currentlyLiked = false -> like

    // Optimistic: A flipped in BOTH caches, B untouched.
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })
    expect(itemIn(qc, FEED_ALL, "B")).toMatchObject({ viewer: { liked: false }, counts: { likes: 5 } })
    expect(qc.getQueryData<PostDTO>(queryKeys.post("A"))).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })

    // Server confirms -> reconcile the authoritative count everywhere.
    opts.onSuccess(server, false, ctx)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ counts: { likes: 9 } })
    expect(qc.getQueryData<PostDTO>(queryKeys.post("A"))).toMatchObject({ counts: { likes: 9 } })
  })

  it("rolls the like back to its exact pre-tap value on error (both caches)", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A")]))
    qc.setQueryData(queryKeys.post("A"), post("A"))

    const opts = loose<boolean, PostDTO>(
      buildToggleMutation(qc, "A", "liked", async () => {
        throw new Error("offline")
      }),
    )
    const ctx = await opts.onMutate(false)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })

    opts.onError(new Error("offline"), false, ctx)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: false }, counts: { likes: 5 } })
    expect(qc.getQueryData<PostDTO>(queryKeys.post("A"))).toMatchObject({ viewer: { liked: false }, counts: { likes: 5 } })
  })
})

describe("useSavePost optimism (buildToggleMutation, manageSaves)", () => {
  it("flips viewer.saved and ADDS the post to the saves list; error removes it again", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A")]))
    qc.setQueryData(queryKeys.saves, feed([]))

    const opts = loose<boolean, PostDTO>(
      buildToggleMutation(
        qc,
        "A",
        "saved",
        async () => {
          throw new Error("offline")
        },
        { manageSaves: true },
      ),
    )
    const ctx = await opts.onMutate(false) // save

    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { saved: true }, counts: { saves: 1 } })
    expect(itemIn(qc, queryKeys.saves, "A")).toMatchObject({ id: "A", viewer: { saved: true } })

    opts.onError(new Error("offline"), false, ctx)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { saved: false }, counts: { saves: 0 } })
    expect(itemIn(qc, queryKeys.saves, "A")).toBeUndefined()
  })

  it("REMOVES the post from the saves list on unsave", async () => {
    const qc = new QueryClient()
    const saved = post("A", {
      viewer: { liked: false, reposted: false, saved: true },
      counts: { likes: 5, reposts: 2, replies: 1, saves: 4 },
    })
    qc.setQueryData(FEED_ALL, feed([saved]))
    qc.setQueryData(queryKeys.saves, feed([saved]))

    const opts = loose<boolean, PostDTO>(
      buildToggleMutation(qc, "A", "saved", async () => saved, { manageSaves: true }),
    )
    await opts.onMutate(true) // currentlySaved = true -> unsave

    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { saved: false }, counts: { saves: 3 } })
    expect(itemIn(qc, queryKeys.saves, "A")).toBeUndefined()
  })
})

describe("useRepost optimism (buildToggleMutation)", () => {
  it("flips viewer.reposted + counts.reposts and rolls back on error", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A")]))

    const opts = loose<boolean, PostDTO>(
      buildToggleMutation(qc, "A", "reposted", async () => {
        throw new Error("offline")
      }),
    )
    const ctx = await opts.onMutate(false)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { reposted: true }, counts: { reposts: 3 } })

    opts.onError(new Error("offline"), false, ctx)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { reposted: false }, counts: { reposts: 2 } })
  })

  it("never stores an original-target response under a pure-repost wrapper key", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("wrapper", { kind: "repost" })]))
    qc.setQueryData(queryKeys.post("wrapper"), post("wrapper", { kind: "repost" }))
    const target = post("original", { viewer: { liked: false, reposted: true, saved: false } })
    const opts = loose<boolean, PostDTO>(
      buildToggleMutation(qc, "wrapper", "reposted", async () => target),
    )
    const ctx = await opts.onMutate(false)
    opts.onSuccess(target, false, ctx)

    expect(qc.getQueryData<PostDTO>(queryKeys.post("wrapper"))?.id).toBe("wrapper")
    expect(qc.getQueryData<PostDTO>(queryKeys.post("original"))).toEqual(target)
    expect(itemIn(qc, FEED_ALL, "wrapper")?.id).toBe("wrapper")
  })
})

describe("useCreatePost optimism (buildCreateMutation)", () => {
  it("prepends the optimistic post to homeFeed('all') + the author's userPosts, then swaps in the server post", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("existing")]))
    const authorKey = queryKeys.userPosts("me")
    qc.setQueryData(authorKey, feed([]))

    const optimistic = post("temp_1", { body: "brand new" })
    const server = post("server_1", { body: "brand new" })
    const api = { createPost: async (_input: PostComposeInput) => server }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "post", body: "brand new", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic,
    }

    const ctx = await opts.onMutate(vars)
    // Optimistic post is at the FRONT of both lists.
    expect(qc.getQueryData<InfiniteData<FeedPageDTO>>(FEED_ALL)!.pages[0]!.items[0]!.id).toBe("temp_1")
    expect(qc.getQueryData<InfiniteData<FeedPageDTO>>(authorKey)!.pages[0]!.items[0]!.id).toBe("temp_1")

    // Server responds -> the temp post is replaced by the authoritative one (id swap, order kept).
    opts.onSuccess(server, vars, ctx)
    expect(qc.getQueryData<InfiniteData<FeedPageDTO>>(FEED_ALL)!.pages[0]!.items[0]!.id).toBe("server_1")
    expect(itemIn(qc, FEED_ALL, "temp_1")).toBeUndefined()
    expect(itemIn(qc, authorKey, "server_1")).toBeDefined()
  })

  it("appends a reply to the parent's replies and bumps the parent reply count; error un-does both", async () => {
    const qc = recordInvalidations(new QueryClient())
    qc.setQueryData(FEED_ALL, feed([post("parent")])) // parent visible in the feed too
    const repliesKey = queryKeys.postReplies("parent")
    qc.setQueryData(repliesKey, feed([post("r0", { kind: "reply", replyToId: "parent" })]))

    const optimistic = post("temp_reply", { kind: "reply", replyToId: "parent", body: "me too" })
    const api = { createPost: async () => post("server_reply", { kind: "reply", replyToId: "parent" }) }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "reply", replyToId: "parent", body: "me too", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic,
    }

    const ctx = await opts.onMutate(vars)
    // Reply appended at the END (chronological); parent reply count bumped in the feed.
    const replies = qc.getQueryData<InfiniteData<FeedPageDTO>>(repliesKey)!.pages[0]!.items
    expect(replies[replies.length - 1]!.id).toBe("temp_reply")
    expect(itemIn(qc, FEED_ALL, "parent")).toMatchObject({ counts: { replies: 2 } })

    opts.onError(new Error("offline"), vars, ctx)
    expect(itemIn(qc, repliesKey, "temp_reply")).toBeUndefined()
    expect(itemIn(qc, FEED_ALL, "parent")).toMatchObject({ counts: { replies: 1 } })

    opts.onSettled(undefined, undefined, vars)
    expect(invalidated(qc)).toEqual(
      expect.arrayContaining([repliesKey, queryKeys.post("parent")]),
    )
  })

  it("answering a reply also refreshes the thread ABOVE it, where the answer inlines under its parent", async () => {
    const qc = recordInvalidations(new QueryClient())
    qc.setQueryData(queryKeys.post("first"), post("first", { kind: "reply", replyToId: "root" }))

    const api = { createPost: async () => post("server_answer", { kind: "reply", replyToId: "first" }) }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "reply", replyToId: "first", body: "answer", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic: post("temp_answer", { kind: "reply", replyToId: "first" }),
    }

    opts.onSettled(undefined, undefined, vars)
    expect(invalidated(qc)).toEqual(
      expect.arrayContaining([
        queryKeys.postReplies("first"),
        queryKeys.post("first"),
        queryKeys.postReplies("root"),
      ]),
    )
  })

  it("skips the grandparent refresh, without throwing, when the parent detail is not cached", async () => {
    const qc = recordInvalidations(new QueryClient())
    const api = { createPost: async () => post("server_answer", { kind: "reply", replyToId: "first" }) }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "reply", replyToId: "first", body: "answer", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic: post("temp_answer", { kind: "reply", replyToId: "first" }),
    }

    expect(() => opts.onSettled(undefined, undefined, vars)).not.toThrow()
    const replyLists = invalidated(qc).filter((key) => key[0] === "posts" && key[1] === "replies")
    expect(replyLists).toEqual([queryKeys.postReplies("first")])
  })

  it("a reply to a TOP-LEVEL post refreshes only that post's thread, never a phantom grandparent", async () => {
    const qc = recordInvalidations(new QueryClient())
    qc.setQueryData(queryKeys.post("root"), post("root"))

    const api = { createPost: async () => post("server_reply", { kind: "reply", replyToId: "root" }) }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "reply", replyToId: "root", body: "reply", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic: post("temp_reply", { kind: "reply", replyToId: "root" }),
    }

    opts.onSettled(undefined, undefined, vars)
    const replyLists = invalidated(qc).filter((key) => key[0] === "posts" && key[1] === "replies")
    expect(replyLists).toEqual([queryKeys.postReplies("root")])
  })

  it("does NOT append the optimistic reply while the thread's tail page is unloaded", async () => {
    // `listReplies` is ASC/oldest-first, so a new reply belongs at the very end of the thread. When the
    // last LOADED page still has a cursor, appending there would drop the reply into the MIDDLE of the
    // thread - where it looks wrong and then vanishes on the onSettled invalidation.
    const qc = recordInvalidations(new QueryClient())
    qc.setQueryData(FEED_ALL, feed([post("parent")]))
    const repliesKey = queryKeys.postReplies("parent")
    qc.setQueryData(repliesKey, {
      pages: [{ items: [post("r0", { kind: "reply", replyToId: "parent" })], nextCursor: "cursor-2" }],
      pageParams: [undefined],
    })

    const optimistic = post("temp_reply", { kind: "reply", replyToId: "parent", body: "me too" })
    const api = { createPost: async () => post("server_reply", { kind: "reply", replyToId: "parent" }) }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "reply", replyToId: "parent", body: "me too", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic,
    }

    const ctx = await opts.onMutate(vars)
    expect(itemIn(qc, repliesKey, "temp_reply")).toBeUndefined()
    expect(ctx.touchedKeys).toHaveLength(0)
    // The parent's reply count is still bumped, and onError still un-bumps it in THIS branch too.
    expect(itemIn(qc, FEED_ALL, "parent")).toMatchObject({ counts: { replies: 2 } })
    opts.onError(new Error("offline"), vars, ctx)
    expect(itemIn(qc, FEED_ALL, "parent")).toMatchObject({ counts: { replies: 1 } })

    opts.onSettled(undefined, undefined, vars)
    expect(invalidated(qc)).toEqual(
      expect.arrayContaining([repliesKey, queryKeys.post("parent")]),
    )
  })

  // The server's `events` feed predicate is exactly `p.event_id IS NOT NULL`, so an event-attached post
  // belongs to BOTH the "all" and the "events" filter. Without this it never reached Events until some
  // unrelated refetch happened to pull it in.
  it("also prepends to (and invalidates) the EVENTS filter when the post carries an eventId", async () => {
    const qc = recordInvalidations(new QueryClient())
    const eventsKey = queryKeys.homeFeed("events", "me")
    qc.setQueryData(FEED_ALL, feed([post("existing")]))
    qc.setQueryData(eventsKey, feed([]))
    qc.setQueryData(queryKeys.userPosts("me"), feed([]))

    const optimistic = post("temp_1")
    const server = post("server_1")
    const api = { createPost: async () => server }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "post", eventId: "event-1", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic,
    }

    const ctx = await opts.onMutate(vars)
    expect(itemIn(qc, FEED_ALL, "temp_1")).toBeDefined()
    expect(itemIn(qc, eventsKey, "temp_1")).toBeDefined()

    // The server row replaces the temp one in BOTH feed lists.
    opts.onSuccess(server, vars, ctx)
    expect(itemIn(qc, eventsKey, "server_1")).toBeDefined()
    expect(itemIn(qc, eventsKey, "temp_1")).toBeUndefined()

    opts.onSettled(server, undefined, vars)
    expect(invalidated(qc)).toEqual(
      expect.arrayContaining([queryKeys.homeFeedRoot("all"), queryKeys.homeFeedRoot("events")]),
    )
  })

  it("leaves the BARE-post path byte-identical: no events key is touched or invalidated", async () => {
    const qc = recordInvalidations(new QueryClient())
    const eventsKey = queryKeys.homeFeed("events", "me")
    qc.setQueryData(FEED_ALL, feed([]))
    qc.setQueryData(eventsKey, feed([]))

    const optimistic = post("temp_1")
    const api = { createPost: async () => post("server_1") }
    const opts = loose<CreatePostVars, PostDTO, CreateCtx>(buildCreateMutation(qc, api))
    const vars: CreatePostVars = {
      input: { kind: "post", body: "hello", mediaUploadIds: [], mentionedUserIds: [] },
      optimistic,
    }

    const ctx = await opts.onMutate(vars)
    expect(ctx.touchedKeys).toEqual([FEED_ALL, queryKeys.userPosts("me")])
    expect(itemIn(qc, eventsKey, "temp_1")).toBeUndefined()

    opts.onSettled(undefined, undefined, vars)
    expect(invalidated(qc)).toEqual([queryKeys.homeFeedRoot("all"), queryKeys.userPosts("me")])
  })
})

describe("useDeletePost optimism (buildDeleteMutation)", () => {
  it("removes the post from every list + drops its detail; error restores all", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A"), post("B")]))
    qc.setQueryData(queryKeys.userPosts("me"), feed([post("A")]))
    qc.setQueryData(queryKeys.post("A"), post("A"))

    const api = { deletePost: async () => ({ ok: true as const }) }
    const opts = loose<string, { ok: true }>(buildDeleteMutation(qc, api))
    const ctx = await opts.onMutate("A")

    expect(itemIn(qc, FEED_ALL, "A")).toBeUndefined()
    expect(itemIn(qc, FEED_ALL, "B")).toBeDefined()
    expect(itemIn(qc, queryKeys.userPosts("me"), "A")).toBeUndefined()
    expect(qc.getQueryData(queryKeys.post("A"))).toBeUndefined()

    opts.onError(new Error("offline"), "A", ctx)
    expect(itemIn(qc, FEED_ALL, "A")).toBeDefined()
    expect(itemIn(qc, queryKeys.userPosts("me"), "A")).toBeDefined()
    expect(qc.getQueryData(queryKeys.post("A"))).toMatchObject({ id: "A" })
  })
})

describe("concurrent-toggle context isolation", () => {
  it("rolls back only the failing post's like, leaving a concurrent like on another post intact", async () => {
    const qc = new QueryClient()
    qc.setQueryData(FEED_ALL, feed([post("A"), post("B")]))

    const optsA = loose<boolean, PostDTO>(buildToggleMutation(qc, "A", "liked", async () => post("A"))) // A succeeds
    const optsB = loose<boolean, PostDTO>(
      buildToggleMutation(qc, "B", "liked", async () => {
        throw new Error("offline")
      }),
    )

    // Both toggles fire optimistically (interleaved), each carrying its OWN per-call context.
    const ctxA = await optsA.onMutate(false)
    const ctxB = await optsB.onMutate(false)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })
    expect(itemIn(qc, FEED_ALL, "B")).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })

    // B fails and rolls back TARGETED (only B), using ctxB's snapshot - A's optimistic like survives.
    optsB.onError(new Error("offline"), false, ctxB)
    expect(itemIn(qc, FEED_ALL, "B")).toMatchObject({ viewer: { liked: false }, counts: { likes: 5 } })
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: true }, counts: { likes: 6 } })

    // A then succeeds and reconciles independently.
    optsA.onSuccess(post("A", { viewer: { liked: true, reposted: false, saved: false } }), false, ctxA)
    expect(itemIn(qc, FEED_ALL, "A")).toMatchObject({ viewer: { liked: true } })
  })
})

describe("homeFeedPlaceholder (auth-scope key-flip bridge)", () => {
  // The scenario: FeedBody booted with the WRONG auth-scope guess, the guess's fetch already rendered
  // posts, and AuthHydrator's reconcile flips the key. The placeholder must hold those pages so the feed
  // does not fall back to skeletons ("the feed loads twice") - but ONLY across a same-filter scope flip.
  const pages = feed([post("A"), post("B")])

  it("keeps the previous pages when the scope flips within the same filter (public -> me)", () => {
    expect(
      homeFeedPlaceholder(pages, { queryKey: queryKeys.homeFeed("all", "public") }, "all"),
    ).toBe(pages)
  })

  it("keeps the previous pages on the reverse flip (me -> public, expired session)", () => {
    expect(homeFeedPlaceholder(pages, { queryKey: queryKeys.homeFeed("all", "me") }, "all")).toBe(
      pages,
    )
  })

  it("does NOT bridge a FILTER change - the All -> Events tab handoff keeps its skeleton", () => {
    expect(
      homeFeedPlaceholder(pages, { queryKey: queryKeys.homeFeed("all", "me") }, "events"),
    ).toBeUndefined()
  })

  it("stays a genuine first load when there is no previous query at all", () => {
    expect(homeFeedPlaceholder(undefined, undefined, "all")).toBeUndefined()
    expect(homeFeedPlaceholder(pages, undefined, "all")).toBeUndefined()
  })

  it("ignores a previous query from an unrelated key namespace", () => {
    expect(homeFeedPlaceholder(pages, { queryKey: queryKeys.saves }, "all")).toBeUndefined()
  })
})
