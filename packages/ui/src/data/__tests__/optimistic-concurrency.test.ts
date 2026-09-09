/**
 * Regression test: an optimistic mutation's ERROR rollback must undo only ITS OWN patch.
 *
 * BUG. `optimisticListPatch.onError` used to write the whole pre-mutation `InfiniteData` snapshot back,
 * and `useFollowPerson`'s `also.onError` restored every snapshotted profile / flat-list / connections
 * entry wholesale. With two toggles in flight on DIFFERENT items the interleaving
 *
 *     A.onMutate -> B.onMutate -> A.onError
 *
 * restored the pre-B cache, silently wiping B's optimistic patch (and corrupting B's own rollback path,
 * since B would then "roll back" from a state that no longer contains its patch). posts.ts had already
 * abandoned this shape for a targeted per-item rollback for exactly this reason.
 *
 * FIX. `optimisticListPatch` snapshots only the MATCHED items and re-writes those into the CURRENT cache;
 * `buildFollowMutation` re-applies the target person's pre-tap `{ isFollowing, followers }` through the
 * same id-scoped patch helpers it used going forward, and un-nudges the viewer's `following` stat by the
 * inverse delta instead of restoring a snapshot.
 *
 * Both are driven here through the REAL exported implementations (no hand-reassembled options block).
 */
import { describe, expect, it } from "vitest"
import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import type { PersonDTO, FollowPersonResponse, GetProfileResponse } from "@civfix/shared"
import { optimisticListPatch } from "../optimistic"
import { queryKeys } from "../keys"
import { buildFollowMutation } from "../hooks/social"

/**
 * react-query's option callbacks carry extra trailing params (mutation / context) in their full type.
 * These tests exercise only the cache-patch BEHAVIOR, so they are invoked through a loose alias.
 */
type LooseOptions = {
  onMutate?: (vars: boolean) => Promise<unknown> | unknown
  onError?: (err: unknown, vars: boolean, ctx: unknown) => void
  onSuccess?: (res: FollowPersonResponse, vars: boolean, ctx: unknown) => void
}

function person(id: string, isFollowing: boolean, followers: number): PersonDTO {
  return {
    id,
    name: `User ${id}`,
    handle: id,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers,
    following: 0,
    isFollowing,
  } as PersonDTO
}

function profileResponse(id: string, isFollowing: boolean, followers: number): GetProfileResponse {
  return {
    profile: {
      id,
      name: `User ${id}`,
      handle: id,
      bio: null,
      avatar: null,
      avatarUrl: null,
      followers,
      following: 7,
      isFollowing,
      pastEvents: [],
      stats: { reports: 0, fixed: 0, cleanups: 0 },
    },
  } as GetProfileResponse
}

describe("optimisticListPatch: targeted per-item rollback", () => {
  const PEOPLE_KEY = ["people"] as const

  /** The follow-shaped list options, parameterised by target id (the shape useFollowPerson builds). */
  function build(qc: QueryClient, id: string): LooseOptions {
    return optimisticListPatch<PersonDTO, boolean, FollowPersonResponse, undefined>(qc, {
      key: PEOPLE_KEY,
      mutationFn: async () => ({ isFollowing: true, followers: 1 }),
      matches: (p) => p.id === id,
      patchItem: (p, currentlyFollowing) => ({
        ...p,
        isFollowing: !currentlyFollowing,
        followers: currentlyFollowing ? Math.max(0, p.followers - 1) : p.followers + 1,
      }),
    }) as unknown as LooseOptions
  }

  function rows(qc: QueryClient): PersonDTO[] {
    return qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(PEOPLE_KEY)!.pages.flatMap((p) => p.items)
  }

  it("A's rollback leaves a concurrent B's optimistic patch intact", async () => {
    const qc = new QueryClient()
    qc.setQueryData<InfiniteData<{ items: PersonDTO[] }>>(PEOPLE_KEY, {
      pages: [{ items: [person("a", false, 4), person("b", false, 9)] }],
      pageParams: [undefined],
    })

    const a = build(qc, "a")
    const b = build(qc, "b")

    // A.onMutate -> B.onMutate -> A.onError (the interleaving that used to wipe B).
    const ctxA = await a.onMutate?.(false)
    await b.onMutate?.(false)
    expect(rows(qc)).toEqual([
      expect.objectContaining({ id: "a", isFollowing: true, followers: 5 }),
      expect.objectContaining({ id: "b", isFollowing: true, followers: 10 }),
    ])

    a.onError?.(new Error("offline"), false, ctxA as never)

    expect(rows(qc)).toEqual([
      // A rolled back to its exact pre-tap value...
      expect.objectContaining({ id: "a", isFollowing: false, followers: 4 }),
      // ...and B's in-flight optimistic patch survived.
      expect.objectContaining({ id: "b", isFollowing: true, followers: 10 }),
    ])
  })

  it("rolls back across pages, matching items in page order", async () => {
    const qc = new QueryClient()
    qc.setQueryData<InfiniteData<{ items: PersonDTO[] }>>(PEOPLE_KEY, {
      pages: [{ items: [person("a", false, 4)] }, { items: [person("b", false, 9), person("a", false, 4)] }],
      pageParams: [undefined, "c1"],
    })

    const a = build(qc, "a")
    const ctx = await a.onMutate?.(false)
    a.onError?.(new Error("offline"), false, ctx as never)

    expect(rows(qc)).toEqual([
      expect.objectContaining({ id: "a", isFollowing: false, followers: 4 }),
      expect.objectContaining({ id: "b", isFollowing: false, followers: 9 }),
      expect.objectContaining({ id: "a", isFollowing: false, followers: 4 }),
    ])
  })
})

describe("buildFollowMutation: targeted side-cache rollback", () => {
  const server = async (): Promise<FollowPersonResponse> => ({ isFollowing: true, followers: 1 })

  it("A's rollback leaves a concurrent B's profile + flat-list patch intact", async () => {
    const qc = new QueryClient()
    qc.setQueryData<GetProfileResponse>(queryKeys.profile("a"), profileResponse("a", false, 4))
    qc.setQueryData<GetProfileResponse>(queryKeys.profile("b"), profileResponse("b", false, 9))
    qc.setQueryData<PersonDTO[]>(queryKeys.peopleSearch("x"), [person("a", false, 4), person("b", false, 9)])

    const a = buildFollowMutation(qc, "a", server) as unknown as LooseOptions
    const b = buildFollowMutation(qc, "b", server) as unknown as LooseOptions

    const ctxA = await a.onMutate?.(false)
    await b.onMutate?.(false)
    a.onError?.(new Error("offline"), false, ctxA as never)

    expect(qc.getQueryData<GetProfileResponse>(queryKeys.profile("a"))!.profile).toMatchObject({
      isFollowing: false,
      followers: 4,
    })
    // B's optimistic follow survives A's failure.
    expect(qc.getQueryData<GetProfileResponse>(queryKeys.profile("b"))!.profile).toMatchObject({
      isFollowing: true,
      followers: 10,
    })
    const flat = qc.getQueryData<PersonDTO[]>(queryKeys.peopleSearch("x"))!
    expect(flat.find((p) => p.id === "a")).toMatchObject({ isFollowing: false, followers: 4 })
    expect(flat.find((p) => p.id === "b")).toMatchObject({ isFollowing: true, followers: 10 })
  })

  it("un-nudges the viewer's `following` stat by the inverse delta, keeping a concurrent nudge", async () => {
    const qc = new QueryClient()
    qc.setQueryData<GetProfileResponse>(queryKeys.myProfile, profileResponse("me", false, 0))
    qc.setQueryData<GetProfileResponse>(queryKeys.profile("a"), profileResponse("a", false, 4))
    qc.setQueryData<GetProfileResponse>(queryKeys.profile("b"), profileResponse("b", false, 9))

    const a = buildFollowMutation(qc, "a", server) as unknown as LooseOptions
    const b = buildFollowMutation(qc, "b", server) as unknown as LooseOptions

    const ctxA = await a.onMutate?.(false) // following 7 -> 8
    await b.onMutate?.(false) //              following 8 -> 9
    a.onError?.(new Error("offline"), false, ctxA as never) // A un-nudges: 9 -> 8, B's +1 kept.

    expect(qc.getQueryData<GetProfileResponse>(queryKeys.myProfile)!.profile.following).toBe(8)
  })

  it("does not un-nudge a `following` count it never nudged (myProfile uncached at mutate time)", async () => {
    const qc = new QueryClient()
    qc.setQueryData<GetProfileResponse>(queryKeys.profile("a"), profileResponse("a", false, 4))

    // myProfile is NOT cached when the toggle fires, so the forward nudge is a no-op.
    const a = buildFollowMutation(qc, "a", server) as unknown as LooseOptions
    const ctxA = await a.onMutate?.(false)
    expect(qc.getQueryData<GetProfileResponse>(queryKeys.myProfile)).toBeUndefined()

    // ...but a myProfile fetch lands WHILE the follow request is in flight (`also.cancel` only stops
    // fetches that were in flight at mutate time), seeding a server-fresh `following: 7`.
    qc.setQueryData<GetProfileResponse>(queryKeys.myProfile, profileResponse("me", false, 0))

    a.onError?.(new Error("offline"), false, ctxA as never)

    // The rollback must leave that fresh count alone: inverting a nudge that never happened would show
    // "Following 6" until the next refetch.
    expect(qc.getQueryData<GetProfileResponse>(queryKeys.myProfile)!.profile.following).toBe(7)
  })

  it("rolls back a connections-list row it also derived its snapshot from", async () => {
    const qc = new QueryClient()
    qc.setQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following("viewer"), {
      pages: [{ items: [person("a", true, 10)] }],
      pageParams: [undefined],
    })

    const a = buildFollowMutation(qc, "a", server) as unknown as LooseOptions
    const ctx = await a.onMutate?.(true) // unfollow: 10 -> 9
    expect(
      qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following("viewer"))!.pages[0]!.items[0],
    ).toMatchObject({ isFollowing: false, followers: 9 })

    a.onError?.(new Error("offline"), true, ctx as never)
    expect(
      qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following("viewer"))!.pages[0]!.items[0],
    ).toMatchObject({ isFollowing: true, followers: 10 })
  })
})
