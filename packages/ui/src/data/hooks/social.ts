import { useCallback, useMemo, useState } from "react"
import type { QueryClient, InfiniteData } from "@tanstack/react-query"
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  PersonDTO,
  CleanupDTO,
  GetProfileResponse,
  FollowPersonResponse,
  ListPeopleResponse,
  ProfileEventsResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserProfileDTO,
  SearchUsersResponse,
  HandleAvailableResponse,
} from "@civfix/shared"
import { isValidHandle } from "@civfix/shared"
import { useApi } from "../context"
import { useAuthState } from "../context"
import { useOnUserUpdated } from "../context"
import { queryKeys } from "../keys"
import { listItems } from "../types"
import { optimisticListPatch } from "../optimistic"
import { useDebouncedValue } from "./useDebouncedValue"
import {
  profilePastEventsAction,
  profilePastEventsView,
  type ProfilePastEventsState,
} from "./profilePastEventsModel"

const MENTION_DEBOUNCE_MS = 200

const HANDLE_AVAILABILITY_DEBOUNCE_MS = 300

const PEOPLE_LIST_KEY = ["people"] as const

function patchPersonInFlatLists(
  qc: QueryClient,
  personId: string,
  next: { isFollowing: boolean; followers: number },
): void {
  qc.setQueriesData<PersonDTO[]>({ queryKey: PEOPLE_LIST_KEY }, (prev) =>
    Array.isArray(prev)
      ? prev.map((p) =>
          p.id === personId ? { ...p, isFollowing: next.isFollowing, followers: next.followers } : p,
        )
      : prev,
  )
}

const CONNECTIONS_KEY = ["connections"] as const

export function patchPersonInConnectionLists(
  qc: QueryClient,
  personId: string,
  next: { isFollowing: boolean; followers: number },
): void {
  qc.setQueriesData<InfiniteData<ListPeopleResponse>>({ queryKey: CONNECTIONS_KEY }, (prev) =>
    prev
      ? {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((p) =>
              p.id === personId
                ? { ...p, isFollowing: next.isFollowing, followers: next.followers }
                : p,
            ),
          })),
        }
      : prev,
  )
}

const PROFILE_KEY = queryKeys.profileRoot

export function patchProfileCaches(
  qc: QueryClient,
  personId: string,
  next: Partial<{ isFollowing: boolean; followers: number }>,
): void {
  qc.setQueriesData<GetProfileResponse>({ queryKey: PROFILE_KEY }, (prev) =>
    prev && prev.profile && prev.profile.id === personId
      ? { ...prev, profile: { ...prev.profile, ...next } }
      : prev,
  )
}

function nudgeMyFollowing(qc: QueryClient, delta: 1 | -1): boolean {
  let applied = false
  qc.setQueryData<GetProfileResponse>(queryKeys.myProfile, (prev) => {
    if (!prev) return prev
    applied = true
    return {
      ...prev,
      profile: { ...prev.profile, following: Math.max(0, prev.profile.following + delta) },
    }
  })
  return applied
}

const FOLLOW_SUGGESTIONS_LIMIT = 10

export function useFollowSuggestions() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<PersonDTO[]>({
    queryKey: queryKeys.followSuggestions,
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await api.followSuggestions({ limit: FOLLOW_SUGGESTIONS_LIMIT })
      return listItems(res?.results)
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useProfile(id: string | undefined) {
  const api = useApi()
  return useQuery<GetProfileResponse>({
    queryKey: queryKeys.profile(id ?? "unknown"),
    enabled: !!id,
    queryFn: () => api.getProfile({ id: id as string }),
    retry: false,
  })
}

export function useMyProfile() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<GetProfileResponse>({
    queryKey: queryKeys.myProfile,
    enabled: isAuthenticated,
    queryFn: () => api.myProfile(),
    retry: false,
  })
}

interface FollowAlsoCtx {
  prevFollow: { isFollowing: boolean; followers: number } | null
  didNudgeMyFollowing: boolean
}

export function buildFollowMutation(
  qc: QueryClient,
  id: string,
  mutationFn: (currentlyFollowing: boolean) => Promise<FollowPersonResponse>,
) {
  return optimisticListPatch<PersonDTO, boolean, FollowPersonResponse, FollowAlsoCtx>(qc, {
    key: PEOPLE_LIST_KEY,
    mutationFn,
    matches: (p) => p.id === id,
    patchItem: (p, currentlyFollowing) => applyFollow(p, !currentlyFollowing),
    reconcileItem: (p, res) => ({ ...p, isFollowing: res.isFollowing, followers: res.followers }),
    also: {
      cancel: (client) =>
        Promise.all([
          client.cancelQueries({ queryKey: PROFILE_KEY }),
          client.cancelQueries({ queryKey: queryKeys.myProfile }),
          client.cancelQueries({ queryKey: PEOPLE_LIST_KEY }),
          client.cancelQueries({ queryKey: CONNECTIONS_KEY }),
        ]).then(() => undefined),
      onMutate: (client, currentlyFollowing): FollowAlsoCtx => {
        const nextFollowing = !currentlyFollowing

        const prevFollow = readFollowSnapshot(client, id)
        const baseFollowers = prevFollow?.followers ?? 0
        const nextFollowers = nextFollowing ? baseFollowers + 1 : Math.max(0, baseFollowers - 1)

        patchProfileCaches(client, id, { isFollowing: nextFollowing, followers: nextFollowers })

        patchPersonInFlatLists(client, id, {
          isFollowing: nextFollowing,
          followers: nextFollowers,
        })

        patchPersonInConnectionLists(client, id, {
          isFollowing: nextFollowing,
          followers: nextFollowers,
        })

        const didNudgeMyFollowing = nudgeMyFollowing(client, nextFollowing ? 1 : -1)

        return { prevFollow, didNudgeMyFollowing }
      },
      onError: (client, currentlyFollowing, ctx) => {
        if (ctx?.didNudgeMyFollowing) nudgeMyFollowing(client, currentlyFollowing ? 1 : -1)
        const prev = ctx?.prevFollow
        if (!prev) return
        patchProfileCaches(client, id, prev)
        patchPersonInFlatLists(client, id, prev)
        patchPersonInConnectionLists(client, id, prev)
      },
      onSuccess: (client, res) => {
        patchProfileCaches(client, id, { isFollowing: res.isFollowing, followers: res.followers })
        patchPersonInFlatLists(client, id, { isFollowing: res.isFollowing, followers: res.followers })
        patchPersonInConnectionLists(client, id, {
          isFollowing: res.isFollowing,
          followers: res.followers,
        })
      },
    },
  })
}

export function useFollowPerson(id: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    buildFollowMutation(qc, id, (currentlyFollowing) =>
      currentlyFollowing ? api.unfollowPerson({ id }) : api.followPerson({ id }),
    ),
  )
}

export function readFollowSnapshot(
  qc: QueryClient,
  personId: string,
): { isFollowing: boolean; followers: number } | null {
  for (const [, data] of qc.getQueriesData<GetProfileResponse>({ queryKey: PROFILE_KEY })) {
    if (data?.profile?.id === personId) {
      return { isFollowing: data.profile.isFollowing, followers: data.profile.followers }
    }
  }
  for (const [, data] of qc.getQueriesData<PersonDTO[]>({ queryKey: PEOPLE_LIST_KEY })) {
    const match = Array.isArray(data) ? data.find((p) => p.id === personId) : undefined
    if (match) return { isFollowing: match.isFollowing, followers: match.followers }
  }
  for (const [, data] of qc.getQueriesData<InfiniteData<ListPeopleResponse>>({
    queryKey: CONNECTIONS_KEY,
  })) {
    const match = data?.pages.flatMap((p) => p.items).find((p) => p.id === personId)
    if (match) return { isFollowing: match.isFollowing, followers: match.followers }
  }
  return null
}

function applyFollow<T extends { isFollowing: boolean; followers: number }>(
  person: T,
  nextFollowing: boolean,
): T {
  const delta = nextFollowing ? 1 : -1
  return {
    ...person,
    isFollowing: nextFollowing,
    followers: Math.max(0, person.followers + delta),
  }
}

function coercePeoplePages(data: InfiniteData<ListPeopleResponse>): InfiniteData<ListPeopleResponse> {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: Array.isArray(p?.items) ? p.items.filter((it) => it != null) : [],
    })),
  }
}

export function useFollowers(id: string | undefined) {
  const api = useApi()
  return useInfiniteQuery<ListPeopleResponse>({
    queryKey: queryKeys.followers(id ?? "unknown"),
    enabled: !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listFollowers({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListPeopleResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coercePeoplePages,
  })
}

export function useFollowing(id: string | undefined) {
  const api = useApi()
  return useInfiniteQuery<ListPeopleResponse>({
    queryKey: queryKeys.following(id ?? "unknown"),
    enabled: !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listFollowing({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListPeopleResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coercePeoplePages,
  })
}

/**
 * GET /people/:id/events - the PAST half of a profile's events beyond the inline first page.
 *
 * `UserProfileDTO.pastEvents` is page one and `UserProfileDTO.pastEventsCursor` is where it ended, so
 * this infinite query STARTS at that anchor rather than at the beginning: `initialPageParam` is the
 * anchor itself, and the anchor is part of the cache key so a profile refetch that moves it starts a
 * fresh accumulation instead of appending to a stale one. Disabled until the viewer asks for more (and
 * whenever the anchor is null, i.e. the inline page was the whole history).
 *
 * The endpoint serves the past list ONLY - the upcoming list is viewer-scoped and bounded server-side
 * (DECISIONS section 20), so it never arrives here.
 */
export function useProfileEvents(
  id: string | undefined,
  anchor: string | null | undefined,
  enabled: boolean,
) {
  const api = useApi()
  const cursor = anchor ?? null
  return useInfiniteQuery<ProfileEventsResponse>({
    queryKey: queryKeys.profileEvents(id ?? "unknown", cursor),
    enabled: !!id && enabled && cursor !== null,
    initialPageParam: (cursor ?? undefined) as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getProfileEvents({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ProfileEventsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

/** What a profile body needs to render its past-events list plus a "Show more" affordance. */
export interface ProfilePastEvents {
  /** The inline first page followed by every page fetched so far, in server order. */
  events: CleanupDTO[]
  /** Render the control at all: the anchor is unspent, or a fetched page reported a cursor after it. */
  canLoadMore: boolean
  isLoadingMore: boolean
  isError: boolean
  /** Render the control as a retry: the last press failed and pressing again will re-run it. */
  isRetry: boolean
  loadMore: () => void
}

/**
 * The "Show more" controller both profile surfaces share (own profile via ProfileView, someone else's via
 * PersonDetailBody), so the paging semantics cannot drift between them.
 *
 * The first press ARMS the query (nothing is fetched before that - a profile that is only looked at costs
 * one request, not two); later presses page it, and a press after a failure RETRIES it. "Armed" is tracked
 * as the ANCHOR it was armed for rather than a boolean, so a different profile, or the same profile whose
 * cursor moved, resets to unarmed with no effect to clean up.
 *
 * Every derivation lives in `profilePastEventsModel` and is unit-tested there, including why this hook
 * must NOT read `hasNextPage` as "there is more history".
 */
export function useProfilePastEvents(profile: UserProfileDTO | undefined): ProfilePastEvents {
  const anchor = profile?.pastEventsCursor ?? null
  const [armedAnchor, setArmedAnchor] = useState<string | null>(null)
  const armed = anchor !== null && armedAnchor === anchor

  const query = useProfileEvents(profile?.id, anchor, armed)
  const pages = query.data?.pages
  const inline = profile?.pastEvents
  const fetched = useMemo(() => (pages ?? []).flatMap((page) => page.items), [pages])
  const events = useMemo(() => [...(inline ?? []), ...fetched], [inline, fetched])

  const { fetchNextPage, refetch, hasNextPage, isFetching, isSuccess, isError } = query
  const state: ProfilePastEventsState = {
    anchor,
    armed,
    isFetching,
    isSuccess,
    isError,
    hasNextPage,
  }
  const view = profilePastEventsView(state)

  const action = profilePastEventsAction(state)
  const loadMore = useCallback(() => {
    if (action === "arm" && anchor !== null) setArmedAnchor(anchor)
    else if (action === "next") void fetchNextPage()
    else if (action === "retry") void refetch()
  }, [action, anchor, fetchNextPage, refetch])

  return { events, ...view, isError, loadMore }
}

export function useUpdateProfile() {
  const api = useApi()
  const qc = useQueryClient()
  const onUserUpdated = useOnUserUpdated()
  return useMutation<UpdateProfileResponse, unknown, UpdateProfileRequest>({
    mutationFn: (body) => api.updateProfile(body),
    onSuccess: (res) => {
      onUserUpdated?.(res.user)
      void qc.invalidateQueries({ queryKey: queryKeys.profile(res.user.id) })
      void qc.invalidateQueries({ queryKey: PEOPLE_LIST_KEY })
      // Settings builds its next save from this profile, so mutateAsync must not resolve before it is fresh.
      return qc.invalidateQueries({ queryKey: queryKeys.myProfile })
    },
  })
}

export function useHandleAvailability(handle: string, currentHandle: string | null | undefined) {
  const api = useApi()
  const candidate = useDebouncedValue(handle.trim(), HANDLE_AVAILABILITY_DEBOUNCE_MS)
  const enabled =
    candidate.length > 0 &&
    isValidHandle(candidate) &&
    candidate.toLowerCase() !== (currentHandle ?? "").trim().toLowerCase()
  return useQuery<HandleAvailableResponse>({
    queryKey: queryKeys.handleAvailable(candidate),
    enabled,
    queryFn: () => api.checkHandle({ handle: candidate }),
    retry: false,
    staleTime: 30_000,
  })
}

export function useMentionSearch(rawPrefix: string) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const q = useDebouncedValue(rawPrefix, MENTION_DEBOUNCE_MS)
  const trimmed = q.trim().replace(/^@+/, "")
  return useQuery<SearchUsersResponse, unknown, SearchUsersResponse>({
    queryKey: queryKeys.mentionSearch(trimmed),
    enabled: isAuthenticated && trimmed.length >= 1,
    queryFn: () => api.mentionSearch({ q: trimmed }),
    retry: false,
    staleTime: 30_000,
  })
}
