/**
 * Regression test for issue #65 - "Follow/unfollow button doesn't update until page refresh".
 *
 * ROOT CAUSE: a cache-KEY mismatch. The person-detail screen is navigated with the person's @HANDLE as
 * the route id (SocialBody pushes `id: person.handle ?? person.id`), so `useProfile(handle)` caches the
 * profile under `queryKeys.profile(HANDLE)`. But `useFollowPerson` is called with the person's UUID, and
 * the old optimistic patches targeted the EXACT `queryKeys.profile(UUID)` - an empty cache entry. The
 * `if (prevProfile)` guard then skipped every write, so the displayed handle-keyed profile never changed
 * and (with no onSettled invalidation) the button only flipped on a manual refetch.
 *
 * THE FIX (social.ts): patch/snapshot/reconcile the profile detail by matching `profile.id === personId`
 * over the WHOLE `["profile"]` prefix (via `patchProfileCaches` / a prefix-scanning `readFollowSnapshot`)
 * instead of the exact `queryKeys.profile(id)` key - so BOTH the @handle-keyed and the UUID-keyed entry
 * are covered.
 *
 * The hook itself needs a React renderer (this package tests pure cache logic only). This test therefore:
 *   1. Exercises the REAL exported `patchProfileCaches` / `readFollowSnapshot` directly against a profile
 *      cached under a HANDLE key whose `profile.id` is a UUID.
 *   2. Assembles the SAME `optimisticListPatch` options block `useFollowPerson` builds - reusing the REAL
 *      exported helpers in its `also` callbacks - and drives onMutate/onSuccess/onError end-to-end with
 *      the handle != UUID case, asserting the optimistic flip, the server reconcile, and the rollback.
 *
 * CRITICAL: this test seeds the profile under the HANDLE (not the UUID). The pre-existing
 * follow-cache.test.ts uses `handle === id`, which HIDES this bug; here the handle and UUID differ.
 */
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { PersonDTO, FollowPersonResponse, GetProfileResponse } from "@civfix/shared"
import { optimisticListPatch } from "../optimistic"
import { queryKeys } from "../keys"
import { patchProfileCaches, readFollowSnapshot } from "../hooks/social"

const PEOPLE_KEY = ["people"] as const
const PROFILE_KEY = ["profile"] as const

const HANDLE = "janedoe"
const UUID = "11111111-2222-3333-4444-555555555555"

/** A minimal profile DTO cached under a HANDLE key whose `profile.id` is a UUID (the #65 scenario). */
function profileResponse(isFollowing: boolean, followers: number): GetProfileResponse {
  return {
    profile: {
      id: UUID,
      name: "Jane Doe",
      handle: HANDLE,
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

/**
 * react-query's option callbacks carry extra trailing params (mutation / context) in their full type.
 * This test exercises only the cache-patch BEHAVIOR, so the callbacks are invoked through a loose alias.
 */
type LooseOptions = {
  onMutate?: (vars: boolean) => Promise<unknown> | unknown
  onError?: (err: unknown, vars: boolean, ctx: unknown) => void
  onSuccess?: (res: FollowPersonResponse, vars: boolean, ctx: unknown) => void
}

/** Per-call snapshot shape mirrored from the hook's FollowAlsoCtx (the profile slice that matters here). */
interface AlsoCtx {
  prevProfiles?: ReadonlyArray<readonly [readonly unknown[], GetProfileResponse | undefined]>
}

/**
 * Build the SAME useMutation options `useFollowPerson` assembles, but with the profile-cache `also`
 * callbacks delegating to the REAL exported `patchProfileCaches` / `readFollowSnapshot`. The people-list
 * side is left as the primary infinite patch (unused here - no list is seeded). The mutation variable is
 * the CURRENT `isFollowing` (state BEFORE the tap), exactly like the hook.
 */
function buildFollowOptions(
  qc: QueryClient,
  id: string,
  server: () => Promise<FollowPersonResponse>,
): LooseOptions {
  return optimisticListPatch<PersonDTO, boolean, FollowPersonResponse, AlsoCtx>(qc, {
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
      onMutate: (client, currentlyFollowing): AlsoCtx => {
        const nextFollowing = !currentlyFollowing
        const prevProfiles = client
          .getQueriesData<GetProfileResponse>({ queryKey: PROFILE_KEY })
          .filter(([, data]) => data?.profile?.id === id)
        const snap = readFollowSnapshot(client, id)
        const baseFollowers = snap?.followers ?? 0
        const nextFollowers = nextFollowing ? baseFollowers + 1 : Math.max(0, baseFollowers - 1)
        patchProfileCaches(client, id, { isFollowing: nextFollowing, followers: nextFollowers })
        return { prevProfiles }
      },
      onError: (client, _vars, ctx) => {
        if (ctx?.prevProfiles) {
          for (const [key, data] of ctx.prevProfiles) client.setQueryData(key as unknown[], data)
        }
      },
      onSuccess: (client, res) => {
        patchProfileCaches(client, id, { isFollowing: res.isFollowing, followers: res.followers })
      },
    },
  }) as unknown as LooseOptions
}

describe("issue #65: follow toggle patches the HANDLE-keyed profile detail (not just the UUID key)", () => {
  it("patchProfileCaches flips a profile cached under its @handle when called with the UUID", () => {
    const qc = new QueryClient()
    // The detail screen caches the profile under the HANDLE, but profile.id is a UUID.
    qc.setQueryData<GetProfileResponse>(queryKeys.profile(HANDLE), profileResponse(false, 41))
    // An exact `profile(UUID)` entry does NOT exist - the old code wrote here and the screen never saw it.
    expect(qc.getQueryData(queryKeys.profile(UUID))).toBeUndefined()

    patchProfileCaches(qc, UUID, { isFollowing: true, followers: 42 })

    const after = qc.getQueryData<GetProfileResponse>(queryKeys.profile(HANDLE))!
    expect(after.profile).toMatchObject({ id: UUID, isFollowing: true, followers: 42 })
  })

  it("readFollowSnapshot reads the handle-keyed profile by profile.id (so the delta is correct)", () => {
    const qc = new QueryClient()
    qc.setQueryData<GetProfileResponse>(queryKeys.profile(HANDLE), profileResponse(false, 41))
    expect(readFollowSnapshot(qc, UUID)).toEqual({ isFollowing: false, followers: 41 })
  })

  it("(a) optimistic flip, (b) success reconcile, (c) error rollback - all with handle != UUID", async () => {
    // ---- (a) optimistic flip + (b) success reconcile ----
    const qc = new QueryClient()
    qc.setQueryData<GetProfileResponse>(queryKeys.profile(HANDLE), profileResponse(false, 41))

    const okOpts = buildFollowOptions(qc, UUID, async () => ({ isFollowing: true, followers: 42 }))
    // currentlyFollowing = false (state before the tap): the viewer taps "Follow".
    const ctx = await okOpts.onMutate?.(false)

    // (a) The displayed (HANDLE-keyed) profile flips immediately - isFollowing true + followers + 1.
    const optimistic = qc.getQueryData<GetProfileResponse>(queryKeys.profile(HANDLE))!
    expect(optimistic.profile).toMatchObject({ isFollowing: true, followers: 42 })

    // (b) Server confirms with the authoritative count -> reconcile into the same handle-keyed entry.
    okOpts.onSuccess?.({ isFollowing: true, followers: 100 }, false, ctx as never)
    expect(qc.getQueryData<GetProfileResponse>(queryKeys.profile(HANDLE))!.profile).toMatchObject({
      isFollowing: true,
      followers: 100,
    })

    // ---- (c) error rollback to the exact pre-mutation state ----
    const qc2 = new QueryClient()
    qc2.setQueryData<GetProfileResponse>(queryKeys.profile(HANDLE), profileResponse(false, 41))

    const failOpts = buildFollowOptions(qc2, UUID, async () => {
      throw new Error("offline")
    })
    const ctx2 = await failOpts.onMutate?.(false)
    // Optimistically followed.
    expect(qc2.getQueryData<GetProfileResponse>(queryKeys.profile(HANDLE))!.profile).toMatchObject({
      isFollowing: true,
      followers: 42,
    })
    // Error -> rollback to the snapshotted handle-keyed value.
    failOpts.onError?.(new Error("offline"), false, ctx2 as never)
    expect(qc2.getQueryData<GetProfileResponse>(queryKeys.profile(HANDLE))!.profile).toMatchObject({
      isFollowing: false,
      followers: 41,
    })
  })
})
