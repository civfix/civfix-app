/**
 * `useFollowPerson` patches the person across two cache shapes under the `["people"]` prefix: the
 * infinite list at exact `["people"]` and any flat `PersonDTO[]` nested beneath it (reached by an `also`
 * prefix `setQueriesData`). The hook needs a React renderer this package does not have, so the suite
 * drives the same `optimisticListPatch` options against a real QueryClient and asserts both shapes flip
 * optimistically and roll back on error.
 */
import { describe, expect, it } from "vitest"
import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import type { PersonDTO, FollowPersonResponse } from "@civfix/shared"
import { optimisticListPatch } from "../optimistic"
import { queryKeys } from "../keys"
import { patchPersonInConnectionLists } from "../hooks/social"

const PEOPLE_KEY = ["people"] as const
const CONNECTIONS_KEY = ["connections"] as const

/**
 * react-query's option callbacks (onMutate/onError/onSuccess) carry extra trailing params (mutation /
 * context) in their full type. This test exercises only the cache-patch BEHAVIOR, not that type surface,
 * so the callbacks are invoked through a loose alias to avoid threading the unused trailing args.
 */
type LooseOptions = {
  onMutate?: (vars: boolean) => Promise<unknown> | unknown
  onError?: (err: unknown, vars: boolean, ctx: unknown) => void
  onSuccess?: (res: FollowPersonResponse, vars: boolean, ctx: unknown) => void
}

/** A minimal PersonDTO (only the follow-relevant fields matter for these assertions). */
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

/** Patch the person in every FLAT PersonDTO[] under the prefix (the hook's `patchPersonInFlatLists`). */
function patchFlat(
  qc: QueryClient,
  id: string,
  next: { isFollowing: boolean; followers: number },
): void {
  qc.setQueriesData<PersonDTO[]>({ queryKey: PEOPLE_KEY }, (prev) =>
    Array.isArray(prev)
      ? prev.map((p) => (p.id === id ? { ...p, ...next } : p))
      : prev,
  )
}

/** Build the same useMutation options `useFollowPerson` builds, for a target id with a stubbed server. */
function buildFollowOptions(
  qc: QueryClient,
  id: string,
  server: () => Promise<FollowPersonResponse>,
): LooseOptions {
  return optimisticListPatch<
    PersonDTO,
    boolean,
    FollowPersonResponse,
    { prevFlat?: ReadonlyArray<readonly [readonly unknown[], PersonDTO[] | undefined]> }
  >(qc, {
    // (cast below: the test invokes the option callbacks with a trimmed arity; see LooseOptions.)
    key: PEOPLE_KEY,
    mutationFn: () => server(),
    matches: (p) => p.id === id,
    patchItem: (p, currentlyFollowing) => ({
      ...p,
      isFollowing: !currentlyFollowing,
      followers: currentlyFollowing ? Math.max(0, p.followers - 1) : p.followers + 1,
    }),
    reconcileItem: (p, res) => ({ ...p, isFollowing: res.isFollowing, followers: res.followers }),
    also: {
      onMutate: (client, currentlyFollowing) => {
        const prevFlat = client.getQueriesData<PersonDTO[]>({ queryKey: PEOPLE_KEY })
        const base = person(id, currentlyFollowing, 0) // followers read from the flat row below
        const row = prevFlat
          .flatMap(([, d]) => (Array.isArray(d) ? d : []))
          .find((p) => p.id === id)
        const followers = row?.followers ?? base.followers
        patchFlat(client, id, {
          isFollowing: !currentlyFollowing,
          followers: currentlyFollowing ? Math.max(0, followers - 1) : followers + 1,
        })
        return { prevFlat }
      },
      onError: (client, _vars, ctx) => {
        if (ctx?.prevFlat) for (const [k, d] of ctx.prevFlat) client.setQueryData(k as unknown[], d)
      },
      onSuccess: (client, res) => {
        patchFlat(client, id, { isFollowing: res.isFollowing, followers: res.followers })
      },
    },
  }) as unknown as LooseOptions
}

describe("follow toggle people-list reconciliation (task 5)", () => {
  it("optimistically flips a FLAT PersonDTO[] row under the ['people'] prefix on follow", async () => {
    const qc = new QueryClient()
    // The web home-sidebar caches search hits as a flat PersonDTO[] under ["people","search",q].
    qc.setQueryData<PersonDTO[]>(["people", "search", "ann"], [person("u1", false, 4), person("u2", false, 9)])

    const opts = buildFollowOptions(qc, "u1", async () => ({ isFollowing: true, followers: 5 }))
    // currentlyFollowing = false (the state before the tap): follow.
    const ctx = await opts.onMutate?.(false)

    const afterMutate = qc.getQueryData<PersonDTO[]>(["people", "search", "ann"])!
    expect(afterMutate.find((p) => p.id === "u1")).toMatchObject({ isFollowing: true, followers: 5 })
    // The other row is untouched.
    expect(afterMutate.find((p) => p.id === "u2")).toMatchObject({ isFollowing: false, followers: 9 })

    // Server confirms -> reconcile (authoritative count).
    opts.onSuccess?.({ isFollowing: true, followers: 6 }, false, ctx as never)
    expect(qc.getQueryData<PersonDTO[]>(["people", "search", "ann"])!.find((p) => p.id === "u1")).toMatchObject({
      isFollowing: true,
      followers: 6,
    })
  })

  it("rolls the flat row back to its exact pre-tap value on error", async () => {
    const qc = new QueryClient()
    qc.setQueryData<PersonDTO[]>(["people", "search", "ann"], [person("u1", false, 4)])

    const opts = buildFollowOptions(qc, "u1", async () => {
      throw new Error("offline")
    })
    const ctx = await opts.onMutate?.(false)
    // Optimistically followed.
    expect(qc.getQueryData<PersonDTO[]>(["people", "search", "ann"])!.find((p) => p.id === "u1")).toMatchObject({
      isFollowing: true,
      followers: 5,
    })
    // Error -> rollback.
    opts.onError?.(new Error("offline"), false, ctx as never)
    expect(qc.getQueryData<PersonDTO[]>(["people", "search", "ann"])!.find((p) => p.id === "u1")).toMatchObject({
      isFollowing: false,
      followers: 4,
    })
  })

  it("also patches the primary INFINITE list shape at the exact ['people'] key", async () => {
    const qc = new QueryClient()
    const infinite: InfiniteData<{ items: PersonDTO[] }> = {
      pages: [{ items: [person("u1", false, 4)] }],
      pageParams: [undefined],
    }
    qc.setQueryData(PEOPLE_KEY, infinite)

    const opts = buildFollowOptions(qc, "u1", async () => ({ isFollowing: true, followers: 5 }))
    await opts.onMutate?.(false)

    const after = qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(PEOPLE_KEY)!
    expect(after.pages[0]!.items[0]).toMatchObject({ isFollowing: true, followers: 5 })
  })
})

function buildConnectionsFollowOptions(
  qc: QueryClient,
  id: string,
  server: () => Promise<FollowPersonResponse>,
): LooseOptions {
  return optimisticListPatch<
    PersonDTO,
    boolean,
    FollowPersonResponse,
    { prevConn?: ReadonlyArray<readonly [readonly unknown[], InfiniteData<{ items: PersonDTO[] }> | undefined]> }
  >(qc, {
    key: PEOPLE_KEY,
    mutationFn: () => server(),
    matches: (p) => p.id === id,
    patchItem: (p, currentlyFollowing) => ({
      ...p,
      isFollowing: !currentlyFollowing,
      followers: currentlyFollowing ? Math.max(0, p.followers - 1) : p.followers + 1,
    }),
    reconcileItem: (p, res) => ({ ...p, isFollowing: res.isFollowing, followers: res.followers }),
    also: {
      onMutate: (client, currentlyFollowing) => {
        const prevConn = client.getQueriesData<InfiniteData<{ items: PersonDTO[] }>>({
          queryKey: CONNECTIONS_KEY,
        })
        const row = prevConn
          .flatMap(([, d]) => d?.pages.flatMap((pg) => pg.items) ?? [])
          .find((p) => p.id === id)
        const followers = row?.followers ?? 0
        patchPersonInConnectionLists(client, id, {
          isFollowing: !currentlyFollowing,
          followers: currentlyFollowing ? Math.max(0, followers - 1) : followers + 1,
        })
        return { prevConn }
      },
      onError: (client, _vars, ctx) => {
        if (ctx?.prevConn) for (const [k, d] of ctx.prevConn) client.setQueryData(k as unknown[], d)
      },
      onSuccess: (client, res) => {
        patchPersonInConnectionLists(client, id, { isFollowing: res.isFollowing, followers: res.followers })
      },
    },
  }) as unknown as LooseOptions
}

describe("follow toggle connections-list reconciliation", () => {
  const viewer = "viewer-1"

  it("flips a following-list row optimistically and reconciles on success (unfollow)", async () => {
    const qc = new QueryClient()
    qc.setQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer), {
      pages: [{ items: [person("u1", true, 10), person("u2", true, 3)] }],
      pageParams: [undefined],
    })

    const opts = buildConnectionsFollowOptions(qc, "u1", async () => ({ isFollowing: false, followers: 9 }))
    const ctx = await opts.onMutate?.(true)

    const afterMutate = qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer))!
    expect(afterMutate.pages[0]!.items.find((p) => p.id === "u1")).toMatchObject({
      isFollowing: false,
      followers: 9,
    })
    expect(afterMutate.pages[0]!.items.find((p) => p.id === "u2")).toMatchObject({
      isFollowing: true,
      followers: 3,
    })

    opts.onSuccess?.({ isFollowing: false, followers: 8 }, true, ctx as never)
    const afterSuccess = qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer))!
    expect(afterSuccess.pages[0]!.items.find((p) => p.id === "u1")).toMatchObject({
      isFollowing: false,
      followers: 8,
    })
    expect(afterSuccess.pages[0]!.items).toHaveLength(2)
  })

  it("rolls the following-list row back to its exact pre-tap value on error", async () => {
    const qc = new QueryClient()
    qc.setQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer), {
      pages: [{ items: [person("u1", true, 10)] }],
      pageParams: [undefined],
    })

    const opts = buildConnectionsFollowOptions(qc, "u1", async () => {
      throw new Error("offline")
    })
    const ctx = await opts.onMutate?.(true)
    expect(
      qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer))!.pages[0]!.items[0],
    ).toMatchObject({ isFollowing: false, followers: 9 })

    opts.onError?.(new Error("offline"), true, ctx as never)
    expect(
      qc.getQueryData<InfiniteData<{ items: PersonDTO[] }>>(queryKeys.following(viewer))!.pages[0]!.items[0],
    ).toMatchObject({ isFollowing: true, followers: 10 })
  })
})
