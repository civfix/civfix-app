/**
 * Shared React Query hooks for the X-style social feed - queries for reading posts + optimistic
 * mutations for the full action set (like / repost / save / create / delete). Authored framework-light
 * like the rest of the data seam: they reach the host API client through the injected data context
 * (`useApi` / `useAuthState`), use the SHARED `queryKeys`, and the shared optimistic helpers
 * (`optimisticPatch` + `also`). No expo / next / store imports.
 *
 * QUERIES
 *   usePost(id)          - GET /posts/:id          -> a single PostDTO (the `["post", id]` detail cache).
 *   usePostReplies(id)   - GET /posts/:id/replies  -> infinite ListRepliesResponse (a thread's replies
 *                                                     plus the focal author's answers to them).
 *   useHomeFeed(filter)  - GET /feed/home          -> infinite FeedPageDTO (followed + self timeline).
 *   useUserPosts(userId) - GET /people/:id/posts   -> infinite FeedPageDTO (a person's own posts).
 *   useSaves()           - GET /me/saves           -> infinite FeedPageDTO (the viewer's bookmarks).
 *
 * MUTATIONS (optimistic; clone the `useFollowPerson` multi-cache pattern in ./social.ts)
 *   useLikePost(id)      - flip viewer.liked    + counts.likes    across every cache holding the post.
 *   useSavePost(id)      - flip viewer.saved    + counts.saves    AND add/remove it from the saves list.
 *   useRepost(id)        - flip viewer.reposted + counts.reposts  across every cache holding the post.
 *   useCreatePost()      - prepend the new post to homeFeed("all") + the author's userPosts; a reply
 *                          instead appends to the parent's replies and bumps the parent's reply count.
 *   useDeletePost()      - remove the post from every list + drop its detail cache.
 *
 * OPTIMISM. Each toggle patches TWO cache shapes, exactly like the follow toggle: the SINGLE-ENTITY
 * post detail (`queryKeys.post(id)`) via the primary `optimisticPatch`, and EVERY infinite LIST holding
 * the post (home feed / replies / user posts / saves) via an `also` prefix patch over `queryKeys.postsRoot`.
 * Rollback is TARGETED - `onError` re-writes ONLY the target post's pre-mutation value back into the
 * lists (captured per-call in the `also` context), so two concurrent toggles on DIFFERENT posts never
 * clobber each other. `onSuccess` reconciles with the server's authoritative full PostDTO; `onSettled`
 * invalidates the authoritative key.
 *
 * AUTH POSTURE. Every post endpoint is `auth:"required"` (§4.4), so the queries bake
 * `enabled: isAuthenticated` in here (web's posture, matching `useMyProfile` / `useFollowSuggestions`)
 * and never fire a guaranteed-401 while signed out. The per-person / per-post reads additionally gate
 * on a present id.
 */
import type { QueryClient, InfiniteData, UseMutationOptions } from "@tanstack/react-query"
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  ApiClient,
  PostDTO,
  PostComposeInput,
  FeedPageDTO,
  ListRepliesResponse,
  DeletePostResponse,
} from "@civfix/shared"
import { useApi } from "../context"
import { useAuthState } from "../context"
import { queryKeys } from "../keys"
import { optimisticPatch, type OptimisticContext } from "../optimistic"

/** The All / Events / Fixes home-feed filter. Mirrors the shared `HomeFeedQuery.filter` enum. */
export type FeedFilter = "all" | "events" | "fixes"

/** The interaction fields a toggle flips, paired with the count it nudges. */
type ToggleField = "liked" | "reposted" | "saved"

const COUNT_KEY: Record<ToggleField, keyof PostDTO["counts"]> = {
  liked: "likes",
  reposted: "reposts",
  saved: "saves",
}

// ---------------------------------------------------------------------------
// Pure cache-shape helpers (exported for the unit tests, mirroring how ./social.ts
// exports `patchPersonInConnectionLists` etc. for follow-cache.test.ts).
// ---------------------------------------------------------------------------

/** Apply a like/repost/save toggle to a post, nudging the paired count by one (clamped at 0). */
export function applyToggle(post: PostDTO, field: ToggleField, next: boolean): PostDTO {
  const countKey = COUNT_KEY[field]
  const delta = next ? 1 : -1
  return {
    ...post,
    viewer: { ...post.viewer, [field]: next },
    counts: { ...post.counts, [countKey]: Math.max(0, post.counts[countKey] + delta) },
  }
}

/** True when a cached value is an infinite post-list page bag (`{ pages: [{ items }] }`). */
function isInfinitePosts(v: unknown): v is InfiniteData<FeedPageDTO> {
  return !!v && Array.isArray((v as InfiniteData<FeedPageDTO>).pages)
}

/**
 * Patch the target post in EVERY infinite LIST cache under the `["posts"]` prefix (home feed, replies,
 * user posts, saves). Any entry that is not an infinite post list is left untouched. Mirrors the follow
 * toggle's `patchPersonInFlatLists` prefix `setQueriesData`.
 */
export function patchPostInListCaches(
  qc: QueryClient,
  postId: string,
  patch: (post: PostDTO) => PostDTO,
): void {
  qc.setQueriesData<InfiniteData<FeedPageDTO>>({ queryKey: queryKeys.postsRoot }, (prev) =>
    isInfinitePosts(prev)
      ? {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((it) => (it.id === postId ? patch(it) : it)),
          })),
        }
      : prev,
  )
}

/** Find the target post's current value in any list cache under the prefix (for the rollback snapshot). */
export function findPostInLists(qc: QueryClient, postId: string): PostDTO | undefined {
  for (const [, data] of qc.getQueriesData<InfiniteData<FeedPageDTO>>({
    queryKey: queryKeys.postsRoot,
  })) {
    if (!isInfinitePosts(data)) continue
    for (const page of data.pages) {
      const hit = page.items.find((it) => it.id === postId)
      if (hit) return hit
    }
  }
  return undefined
}

/** Prepend a post to page 0 of a specific infinite list cache (no-op when the list is not loaded). */
export function prependToList(qc: QueryClient, key: readonly unknown[], post: PostDTO): void {
  qc.setQueryData<InfiniteData<FeedPageDTO>>(key, (prev) =>
    isInfinitePosts(prev)
      ? {
          ...prev,
          pages: prev.pages.map((page, i) =>
            i === 0 ? { ...page, items: [post, ...page.items] } : page,
          ),
        }
      : prev,
  )
}

/** Append a post to the LAST page of a specific infinite list cache (replies are chronological). */
export function appendToList(qc: QueryClient, key: readonly unknown[], post: PostDTO): void {
  qc.setQueryData<InfiniteData<FeedPageDTO>>(key, (prev) =>
    isInfinitePosts(prev)
      ? {
          ...prev,
          pages: prev.pages.map((page, i) =>
            i === prev.pages.length - 1 ? { ...page, items: [...page.items, post] } : page,
          ),
        }
      : prev,
  )
}

/** Remove a post (by id) from every page of a specific infinite list cache. */
export function removeFromList(qc: QueryClient, key: readonly unknown[], postId: string): void {
  qc.setQueryData<InfiniteData<FeedPageDTO>>(key, (prev) =>
    isInfinitePosts(prev)
      ? { ...prev, pages: prev.pages.map((page) => ({ ...page, items: page.items.filter((it) => it.id !== postId) })) }
      : prev,
  )
}

/** True when a specific infinite list cache already contains the post. */
export function listHasPost(qc: QueryClient, key: readonly unknown[], postId: string): boolean {
  const data = qc.getQueryData<InfiniteData<FeedPageDTO>>(key)
  return isInfinitePosts(data) ? data.pages.some((p) => p.items.some((it) => it.id === postId)) : false
}

/** Replace the optimistic (temp-id) post with the authoritative server post in a specific list cache. */
export function replaceInList(
  qc: QueryClient,
  key: readonly unknown[],
  tempId: string,
  post: PostDTO,
): void {
  qc.setQueryData<InfiniteData<FeedPageDTO>>(key, (prev) =>
    isInfinitePosts(prev)
      ? {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((it) => (it.id === tempId ? post : it)),
          })),
        }
      : prev,
  )
}

// ---------------------------------------------------------------------------
// Mutation option builders (exported so the hook AND the unit test share one truth,
// mirroring how follow-cache.test.ts drives the follow options directly).
// ---------------------------------------------------------------------------

/** Per-call snapshot of the side caches a toggle patches besides the single `post(id)` detail. */
interface ToggleAlsoCtx {
  /** The target post's exact pre-mutation value, for a TARGETED (concurrency-safe) list rollback. */
  original?: PostDTO
}

/**
 * Build the `useMutation` options for a like / repost / save toggle. The mutation variable is the
 * CURRENT flag (the state BEFORE the tap): `true` means we are un-liking / un-reposting / un-saving.
 * The primary `optimisticPatch` owns the single `post(id)` detail; the `also` flips the post across
 * every list holding it (and, for save, adds/removes it from the saves list).
 */
export function buildToggleMutation(
  qc: QueryClient,
  id: string,
  field: ToggleField,
  mutationFn: (currently: boolean) => Promise<PostDTO>,
  options: { manageSaves?: boolean } = {},
): UseMutationOptions<PostDTO, unknown, boolean, OptimisticContext<PostDTO, ToggleAlsoCtx>> {
  const savesKey = queryKeys.saves
  return optimisticPatch<PostDTO, boolean, PostDTO, ToggleAlsoCtx>(qc, {
    key: queryKeys.post(id),
    mutationFn,
    patch: (prev, currently) => applyToggle(prev, field, !currently),
    // Like/save/repost all return the full patched post - adopt it wholesale as the reconciled detail.
    // A repost toggle may resolve a pure-repost wrapper to its original target. Never write a DTO
    // with a different identity under `post(id)`; the target gets its own canonical detail entry in
    // `onSuccess`, which also refetches the lists for that (and only that) identity-shift case.
    reconcile: (prev, res) => res.id === id ? res : prev,
    // Only the authoritative single-post key (and, for save, the saves LIST whose membership changed)
    // is refetched. The lists are already correct: the `also` optimistic patch flips the post in every
    // cache holding it and `onSuccess` re-writes the server's authoritative DTO over that patch. A
    // blanket `postsRoot` invalidation instead refetched EVERY active post list (home feed - all pages -
    // replies, user posts, saves) on every like tap, and could visibly reshuffle an infinite list.
    invalidate: options.manageSaves
      ? [queryKeys.post(id), savesKey]
      : [queryKeys.post(id)],
    also: {
      cancel: (client) => client.cancelQueries({ queryKey: queryKeys.postsRoot }),
      onMutate: (client, currently): ToggleAlsoCtx => {
        const next = !currently
        const original = findPostInLists(client, id) ?? client.getQueryData<PostDTO>(queryKeys.post(id))
        // Flip the post in every list holding it (home feed / replies / user posts / saves).
        patchPostInListCaches(client, id, (p) => applyToggle(p, field, next))
        // Save also mutates the saves-list MEMBERSHIP (a structural add/remove, not just a flag flip).
        if (options.manageSaves && original) {
          if (next) prependToList(client, savesKey, applyToggle(original, field, true))
          else removeFromList(client, savesKey, id)
        }
        return { original }
      },
      onError: (client, currently, ctx) => {
        const original = ctx?.original
        // TARGETED rollback: rewrite ONLY this post's item in each list, leaving concurrent toggles' work.
        if (original) patchPostInListCaches(client, id, () => original)
        if (options.manageSaves) {
          const next = !currently
          if (next) removeFromList(client, savesKey, id)
          else if (original) prependToList(client, savesKey, original)
        }
      },
      onSuccess: (client, res) => {
        // Reconcile the authoritative post everywhere it is listed (the saves membership is settled by
        // the `invalidate` refetch below).
        if (res.id === id) patchPostInListCaches(client, id, () => res)
        else {
          // Identity shift (a pure-repost wrapper resolved to its original target): we have no
          // authoritative DTO for `id` itself, so its optimistically-patched list rows CANNOT be
          // reconciled in place. This is the one case that still needs the blanket list refetch.
          client.setQueryData(queryKeys.post(res.id), res)
          void client.invalidateQueries({ queryKey: queryKeys.postsRoot })
        }
        if (options.manageSaves) {
          if (res.viewer.saved && !listHasPost(client, savesKey, id)) prependToList(client, savesKey, res)
          if (!res.viewer.saved) removeFromList(client, savesKey, id)
        }
      },
    },
  })
}

/** The variables for `useCreatePost`: the wire input plus a client-built optimistic post for instant paint. */
export interface CreatePostVars {
  input: PostComposeInput
  /**
   * A client-built PostDTO (temp id, `author` = the viewer) prepended immediately for zero-latency feel;
   * on success it is swapped for the authoritative server post (matched by its temp id), on error removed.
   */
  optimistic: PostDTO
}

/** Per-call snapshot of what a create touched, so error/success can undo/reconcile precisely. */
interface CreateCtx {
  /** The list caches we prepended/appended the optimistic post to. */
  touchedKeys: readonly (readonly unknown[])[]
  /** The parent post id when this create is a reply (its reply count was bumped). */
  repliedTo?: string
}

/** Bump (or un-bump) a parent post's reply count across the list caches AND its detail cache. */
function nudgeReplyCount(qc: QueryClient, parentId: string, delta: 1 | -1): void {
  const apply = (p: PostDTO): PostDTO => ({
    ...p,
    counts: { ...p.counts, replies: Math.max(0, p.counts.replies + delta) },
  })
  patchPostInListCaches(qc, parentId, apply)
  qc.setQueryData<PostDTO>(queryKeys.post(parentId), (prev) => (prev ? apply(prev) : prev))
}

/** Build the `useMutation` options for creating a post (top-level, quote, or reply). */
export function buildCreateMutation(
  qc: QueryClient,
  api: Pick<ApiClient, "createPost">,
): UseMutationOptions<PostDTO, unknown, CreatePostVars, CreateCtx> {
  return {
    mutationFn: ({ input }) => api.createPost(input),
    onMutate: async ({ input, optimistic }) => {
      await qc.cancelQueries({ queryKey: queryKeys.postsRoot })
      const touchedKeys: (readonly unknown[])[] = []
      if (input.kind === "reply" && input.replyToId) {
        const repliesKey = queryKeys.postReplies(input.replyToId)
        // `listReplies` is ASC/oldest-first, so a new reply belongs at the very END of the thread. On a
        // MULTI-PAGE thread whose tail has not been fetched, appending to the last LOADED page puts it in
        // the middle - where it sits looking wrong and then vanishes on the onSettled invalidation. So the
        // optimistic append only happens when the tail really is loaded (`nextCursor == null`); otherwise
        // the reply simply arrives with the refetch. `touchedKeys` is then empty and onError/onSuccess/
        // onSettled iterate nothing, while `repliedTo` still un-bumps the count in both branches.
        const cached = qc.getQueryData<InfiniteData<FeedPageDTO>>(repliesKey)
        const tailLoaded = cached != null && cached.pages[cached.pages.length - 1]?.nextCursor == null
        if (tailLoaded) {
          appendToList(qc, repliesKey, optimistic)
          touchedKeys.push(repliesKey)
        }
        nudgeReplyCount(qc, input.replyToId, 1)
        return { touchedKeys, repliedTo: input.replyToId }
      }
      // Creating a post requires auth, so the only feed entry a new post can belong to is the
      // signed-in ("me") scope - the SAME key `useHomeFeed` builds while authenticated.
      // A post with an attached EVENT additionally belongs to the "events" filter, whose server predicate
      // is exactly `p.event_id IS NOT NULL` - mirrored here. Guarded on `input.eventId`, so the reply,
      // quote and bare-post paths touch byte-identically the keys they touched before.
      const feedKeys: (readonly unknown[])[] = [queryKeys.homeFeed("all", "me")]
      if (input.eventId) feedKeys.push(queryKeys.homeFeed("events", "me"))
      const authorKey = queryKeys.userPosts(optimistic.author.id)
      for (const key of feedKeys) prependToList(qc, key, optimistic)
      prependToList(qc, authorKey, optimistic)
      touchedKeys.push(...feedKeys, authorKey)
      return { touchedKeys }
    },
    onError: (_err, { optimistic }, ctx) => {
      for (const key of ctx?.touchedKeys ?? []) removeFromList(qc, key, optimistic.id)
      if (ctx?.repliedTo) nudgeReplyCount(qc, ctx.repliedTo, -1)
    },
    onSuccess: (res, { optimistic }, ctx) => {
      for (const key of ctx?.touchedKeys ?? []) replaceInList(qc, key, optimistic.id, res)
    },
    onSettled: (_res, _err, { input, optimistic }) => {
      // Invalidate the filter ROOT so both auth scopes refetch (a sign-out right after a create still
      // reconciles the public entry).
      void qc.invalidateQueries({ queryKey: queryKeys.homeFeedRoot("all") })
      // An event-attached post also lives under the "events" filter (server predicate: event_id NOT NULL).
      if (input.eventId) void qc.invalidateQueries({ queryKey: queryKeys.homeFeedRoot("events") })
      void qc.invalidateQueries({ queryKey: queryKeys.userPosts(optimistic.author.id) })
      if (input.kind === "reply" && input.replyToId) {
        void qc.invalidateQueries({ queryKey: queryKeys.postReplies(input.replyToId) })
        void qc.invalidateQueries({ queryKey: queryKeys.post(input.replyToId) })
      }
    },
  }
}

/** Per-call snapshot of the caches a delete clears, for an exact rollback. */
interface DeleteCtx {
  prevLists: ReadonlyArray<readonly [readonly unknown[], InfiniteData<FeedPageDTO> | undefined]>
  prevDetail?: PostDTO
}

/** Build the `useMutation` options for soft-deleting a post (removes it from every cache). */
export function buildDeleteMutation(
  qc: QueryClient,
  api: Pick<ApiClient, "deletePost">,
): UseMutationOptions<DeletePostResponse, unknown, string, DeleteCtx> {
  return {
    mutationFn: (id) => api.deletePost({ id }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.postsRoot })
      await qc.cancelQueries({ queryKey: queryKeys.post(id) })
      const prevLists = qc.getQueriesData<InfiniteData<FeedPageDTO>>({ queryKey: queryKeys.postsRoot })
      const prevDetail = qc.getQueryData<PostDTO>(queryKeys.post(id))
      qc.setQueriesData<InfiniteData<FeedPageDTO>>({ queryKey: queryKeys.postsRoot }, (prev) =>
        isInfinitePosts(prev)
          ? { ...prev, pages: prev.pages.map((page) => ({ ...page, items: page.items.filter((it) => it.id !== id) })) }
          : prev,
      )
      // `setQueryData(key, undefined)` is a no-op in react-query (returning undefined skips the write), so
      // drop the detail cache with removeQueries; onError re-seeds it from the snapshot.
      qc.removeQueries({ queryKey: queryKeys.post(id) })
      return { prevLists, prevDetail }
    },
    onError: (_err, id, ctx) => {
      if (ctx?.prevLists) for (const [key, data] of ctx.prevLists) qc.setQueryData(key as unknown[], data)
      if (ctx?.prevDetail) qc.setQueryData(queryKeys.post(id), ctx.prevDetail)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.postsRoot })
    },
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Coerce each infinite page's `items` to a real array of non-null posts (the client does not validate). */
function coercePostPages(data: InfiniteData<FeedPageDTO>): InfiniteData<FeedPageDTO> {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: Array.isArray(p?.items) ? p.items.filter((it) => it != null) : [],
    })),
  }
}

/** GET /posts/:id - a single post's detail. Auth-required; additionally gated on a present id. */
export function usePost(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<PostDTO>({
    queryKey: queryKeys.post(id ?? "unknown"),
    enabled: isAuthenticated && !!id,
    queryFn: () => api.getPost({ id: id as string }),
    retry: false,
  })
}

/** Coerce a replies page's two post arrays, so a malformed payload cannot reach the row builder. */
function coerceReplyPages(
  data: InfiniteData<ListRepliesResponse>,
): InfiniteData<ListRepliesResponse> {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: Array.isArray(p?.items) ? p.items.filter((it) => it != null) : [],
      authorReplies: Array.isArray(p?.authorReplies)
        ? p.authorReplies.filter((it) => it != null)
        : [],
    })),
  }
}

/** GET /posts/:id/replies - a thread's replies, cursor-infinite. Auth-required; gated on a present id. */
export function usePostReplies(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListRepliesResponse>({
    queryKey: queryKeys.postReplies(id ?? "unknown"),
    enabled: isAuthenticated && !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const args = { id: id as string, ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }
      return api.listReplies(args)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coerceReplyPages,
  })
}

/**
 * The home feed's `placeholderData`, extracted pure for posts.test.ts. It bridges ONE key change: the
 * auth-SCOPE flip within the SAME filter (`homeFeed(f, "public")` <-> `homeFeed(f, "me")`).
 *
 * Why: `useHomeFeed`'s key carries an auth scope that boots from the host's persisted snapshot GUESS and
 * is reconciled against `GET /auth/session` afterwards (web's `AuthHydrator`). When the terminal answer
 * differs from the guess (cleared storage + a still-valid cookie, or a stale snapshot + an expired
 * session) the key flips seconds into a cold load and — without a placeholder — `data` is `undefined`
 * until the re-fetch lands, so FeedBody visibly falls BACK from rendered posts to skeletons ("the feed
 * loads twice"). Keeping the previous scope's pages on screen while the correct scope loads is safe:
 * both scopes belong to the same viewer on the same device, and the fetched result replaces it.
 *
 * A FILTER change (All -> Events) is deliberately NOT bridged: those tabs show different content on
 * purpose, and holding the old tab's posts under the new tab's heading would misattribute them. That
 * flip keeps the pre-existing skeleton handoff (`previousQuery`'s key differs at the filter segment, so
 * this returns `undefined`).
 */
export function homeFeedPlaceholder(
  prev: InfiniteData<FeedPageDTO> | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
  filter: FeedFilter,
): InfiniteData<FeedPageDTO> | undefined {
  // `homeFeed` keys are ["posts", "feed", filter, scope]; compare against the canonical factory prefix
  // (`homeFeedRoot`) rather than a hand-built tuple so a key-shape change breaks this loudly in tests.
  const root = queryKeys.homeFeedRoot(filter)
  if (!previousQuery || !root.every((seg, i) => previousQuery.queryKey[i] === seg)) return undefined
  return prev
}

/**
 * GET /feed/home - the feed, cursor-infinite, keyed by the feed filter. OPTIONAL auth: a signed-in reader
 * gets their followed-users + self timeline; a signed-out reader gets the public/global feed (you don't
 * have to sign in to read a feed). Always enabled — the client omits the bearer/cookie when signed out and
 * the query key carries the auth state so the cache doesn't leak one viewer's feed into the other.
 * `placeholderData` bridges the boot-time auth-scope key flip (see `homeFeedPlaceholder`).
 */
export function useHomeFeed(filter: FeedFilter = "all") {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<FeedPageDTO>({
    queryKey: queryKeys.homeFeed(filter, isAuthenticated ? "me" : "public"),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.homeFeed({
        filter,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coercePostPages,
    placeholderData: (prev, previousQuery) => homeFeedPlaceholder(prev, previousQuery, filter),
  })
}

/**
 * GET /people/:id/posts - a person's own posts, cursor-infinite. Auth-OPTIONAL, so this gates on the id
 * ALONE: a public profile is a public surface, and gating it on `isAuthenticated` left a signed-out
 * visitor looking at an empty timeline on a profile whose posts anyone can read. The client omits the
 * bearer/cookie when signed out and the server returns the public projection.
 */
export function useUserPosts(id: string | undefined) {
  const api = useApi()
  return useInfiniteQuery<FeedPageDTO>({
    queryKey: queryKeys.userPosts(id ?? "unknown"),
    enabled: !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const args = { id: id as string, ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }
      return api.listUserPosts(args)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coercePostPages,
  })
}

/** GET /me/saves - the viewer's saved / bookmarked posts, cursor-infinite. Auth-required. */
export function useSaves() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<FeedPageDTO>({
    queryKey: queryKeys.saves,
    enabled: isAuthenticated,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listSaves({ ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: coercePostPages,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST/DELETE /posts/:id/like - optimistically flip `viewer.liked` + `counts.likes` everywhere. */
export function useLikePost(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation(
    buildToggleMutation(qc, id, "liked", (currently) =>
      currently ? api.unlikePost({ id }) : api.likePost({ id }),
    ),
  )
}

/**
 * POST/DELETE /posts/:id/save - optimistically flip `viewer.saved` + `counts.saves` everywhere AND
 * add/remove the post from the `saves` list.
 */
export function useSavePost(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation(
    buildToggleMutation(
      qc,
      id,
      "saved",
      (currently) => (currently ? api.unsavePost({ id }) : api.savePost({ id })),
      { manageSaves: true },
    ),
  )
}

/** POST/DELETE /posts/:id/repost - optimistically flip `viewer.reposted` + `counts.reposts` everywhere. */
export function useRepost(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation(
    buildToggleMutation(qc, id, "reposted", (currently) =>
      currently ? api.unrepostPost({ id }) : api.repostPost({ id }),
    ),
  )
}

/** POST /posts - create a post/quote/reply, optimistically prepended (or appended for a reply). */
export function useCreatePost() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation(buildCreateMutation(qc, api))
}

/** DELETE /posts/:id - soft-delete a post, optimistically removed from every cache. */
export function useDeletePost() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation(buildDeleteMutation(qc, api))
}
