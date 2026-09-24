/**
 * optimisticPatch / optimisticListPatch: the shared onMutate/onError/onSuccess dance for an
 * optimistic toggle with rollback.
 *
 * Both helpers return a `UseMutationOptions` object to spread into `useMutation`. They encode the
 * standard sequence once:
 *   onMutate:  cancelQueries(key) -> snapshot getQueryData(key) -> setQueryData(patch) -> return ctx
 *   onError:   restore the snapshot from ctx (per-ITEM for optimisticListPatch, see its note)
 *   onSuccess: optional reconcile with the server response
 *   onSettled: optional invalidate
 *
 * A hook that needs to touch additional caches (e.g. a post toggle patching every list holding the post,
 * or the follow toggle patching a profile detail next to the people list) passes an `also` hook set whose
 * callbacks run inside the same onMutate/onError/onSuccess phases, after the primary key
 * is handled. The `also` snapshot it returns from onMutate is carried in the per-call mutation context
 * (NOT a closure), so concurrent mutations on the same hook each roll back their own snapshot.
 */
import type {
  QueryClient,
  QueryKey,
  UseMutationOptions,
  InfiniteData,
} from "@tanstack/react-query"

/**
 * Side patches that run alongside the primary key within the same mutation phases. `onMutate` may
 * return a snapshot of the extra caches; that value is stored in the mutation context and handed back
 * to `onError` so the rollback is per-call. The result callbacks receive the mutation vars / server
 * result so a hook can mirror the change into other caches.
 */
export interface OptimisticAlso<TVars, TRes, TAlsoCtx> {
  /** Cancel any extra in-flight queries this patch touches (so they cannot clobber the optimistic write). */
  cancel?: (qc: QueryClient) => Promise<void> | void
  /** Apply the optimistic change to the extra caches; return a snapshot for rollback. Runs after the primary patch. */
  onMutate?: (qc: QueryClient, vars: TVars) => TAlsoCtx
  /** Roll the extra caches back on error, using the snapshot `onMutate` returned. */
  onError?: (qc: QueryClient, vars: TVars, ctx: TAlsoCtx | undefined) => void
  /** Reconcile the extra caches with the authoritative server result on success. */
  onSuccess?: (qc: QueryClient, res: TRes) => void
}

/**
 * The mutation context both helpers thread: the primary snapshot plus the optional `also` snapshot.
 * Exported (not just internal) because it appears in the `UseMutationOptions` these helpers return, and
 * therefore in the inferred return type of any hook that spreads them into `useMutation` - a consumer
 * package that emits declarations (@civfix/ui) needs the name to be importable (TS4058).
 */
export interface OptimisticContext<TPrevious, TAlsoCtx> {
  previous?: TPrevious
  alsoCtx?: TAlsoCtx
}

export interface OptimisticPatchOptions<TData, TVars, TRes, TAlsoCtx = unknown> {
  key: QueryKey
  mutationFn: (vars: TVars) => Promise<TRes>
  /** Produce the next cached value from the previous one + the vars (the optimistic write). */
  patch: (prev: TData, vars: TVars) => TData
  /** Produce the reconciled cached value from the current one + the server result (on success). */
  reconcile?: (prev: TData, res: TRes) => TData
  /** Query keys to invalidate in onSettled (after the round-trip). */
  invalidate?: QueryKey[]
  /** Extra caches to patch/rollback/reconcile alongside the primary key. */
  also?: OptimisticAlso<TVars, TRes, TAlsoCtx>
}

/**
 * Single-entity optimistic toggle. Snapshots one query key, applies `patch`, rolls back on error, and
 * (optionally) reconciles with the server response and/or invalidates. Used by useResolveReport,
 * useUnlistReport, useUpdateNotificationPrefs and the post toggles. useJoinCleanup cannot use it: its
 * detail can render under a refcode ALIAS key as well as the UUID, so it runs the same dance over
 * `cleanupDetailFilters` (see data/hooks/cleanups.ts).
 */
export function optimisticPatch<TData, TVars, TRes, TAlsoCtx = unknown>(
  qc: QueryClient,
  {
    key,
    mutationFn,
    patch,
    reconcile,
    invalidate,
    also,
  }: OptimisticPatchOptions<TData, TVars, TRes, TAlsoCtx>,
): UseMutationOptions<TRes, unknown, TVars, OptimisticContext<TData, TAlsoCtx>> {
  return {
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key })
      await also?.cancel?.(qc)
      const previous = qc.getQueryData<TData>(key)
      if (previous !== undefined) {
        qc.setQueryData<TData>(key, patch(previous, vars))
      }
      const alsoCtx = also?.onMutate?.(qc, vars)
      return { previous, alsoCtx }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData<TData>(key, ctx.previous)
      also?.onError?.(qc, vars, ctx?.alsoCtx)
    },
    ...(reconcile || also?.onSuccess
      ? {
          onSuccess: (res: TRes) => {
            if (reconcile) {
              const current = qc.getQueryData<TData>(key)
              if (current !== undefined) qc.setQueryData<TData>(key, reconcile(current, res))
            }
            also?.onSuccess?.(qc, res)
          },
        }
      : {}),
    ...(invalidate && invalidate.length > 0
      ? {
          onSettled: () => {
            for (const k of invalidate) void qc.invalidateQueries({ queryKey: k })
          },
        }
      : {}),
  }
}

export interface OptimisticListPatchOptions<TItem, TVars, TRes, TAlsoCtx = unknown> {
  /** An infinite-list query key whose pages hold `{ items }`. */
  key: QueryKey
  mutationFn: (vars: TVars) => Promise<TRes>
  /** True for the item(s) the mutation targets. */
  matches: (item: TItem, vars: TVars) => boolean
  /** The optimistic per-item patch. */
  patchItem: (item: TItem, vars: TVars) => TItem
  /** The authoritative per-item reconcile on success. */
  reconcileItem?: (item: TItem, res: TRes) => TItem
  /** Query keys to invalidate in onSettled. */
  invalidate?: QueryKey[]
  /** Extra caches (e.g. a profile detail) to patch/rollback/reconcile alongside the list. */
  also?: OptimisticAlso<TVars, TRes, TAlsoCtx>
}

/** Map a per-item patch across every page of an infinite list cache. */
function mapInfinitePages<TItem>(
  data: InfiniteData<{ items: TItem[] }>,
  mapItem: (item: TItem) => TItem,
): InfiniteData<{ items: TItem[] }> {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map(mapItem) })),
  }
}

/**
 * Optimistic per-item toggle across an infinite list cache. Snapshots the matched ITEMS, patches them on
 * every page, rolls those items (and only those) back on error, and (optionally) reconciles + invalidates.
 * Used by the list half of useFollowPerson (the profile detail rides along via `also`).
 *
 * ROLLBACK IS TARGETED, not a whole-list restore. Writing the entire pre-mutation InfiniteData snapshot
 * back on error would wipe any CONCURRENT mutation's optimistic patch on a DIFFERENT item: with two
 * in-flight toggles the ordering A.onMutate -> B.onMutate -> A.onError restores the pre-B list and silently
 * un-does B. So `ctx.previous` carries only the items THIS mutation matched (in page order), and onError
 * re-writes them into the CURRENT cache, leaving every other row (including a concurrent toggle's) alone.
 * This mirrors the per-item `ToggleAlsoCtx.original` rollback in ./hooks/posts.ts.
 */
export function optimisticListPatch<TItem, TVars, TRes, TAlsoCtx = unknown>(
  qc: QueryClient,
  {
    key,
    mutationFn,
    matches,
    patchItem,
    reconcileItem,
    invalidate,
    also,
  }: OptimisticListPatchOptions<TItem, TVars, TRes, TAlsoCtx>,
): UseMutationOptions<TRes, unknown, TVars, OptimisticContext<TItem[], TAlsoCtx>> {
  return {
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key })
      await also?.cancel?.(qc)
      const current = qc.getQueryData<InfiniteData<{ items: TItem[] }>>(key)
      // Snapshot ONLY the matched items, in page order: the order onError replays them in.
      const previous = current
        ? current.pages.flatMap((page) => page.items.filter((item) => matches(item, vars)))
        : undefined
      if (current) {
        qc.setQueryData<InfiniteData<{ items: TItem[] }>>(
          key,
          mapInfinitePages(current, (item) => (matches(item, vars) ? patchItem(item, vars) : item)),
        )
      }
      const alsoCtx = also?.onMutate?.(qc, vars)
      return { previous, alsoCtx }
    },
    onError: (_err, vars, ctx) => {
      const originals = ctx?.previous
      if (originals && originals.length > 0) {
        const current = qc.getQueryData<InfiniteData<{ items: TItem[] }>>(key)
        if (current) {
          const queue = [...originals]
          qc.setQueryData<InfiniteData<{ items: TItem[] }>>(
            key,
            mapInfinitePages(current, (item) => (matches(item, vars) ? queue.shift() ?? item : item)),
          )
        }
      }
      also?.onError?.(qc, vars, ctx?.alsoCtx)
    },
    ...(reconcileItem || also?.onSuccess
      ? {
          onSuccess: (res: TRes, vars: TVars) => {
            if (reconcileItem) {
              const current = qc.getQueryData<InfiniteData<{ items: TItem[] }>>(key)
              if (current) {
                qc.setQueryData<InfiniteData<{ items: TItem[] }>>(
                  key,
                  mapInfinitePages(current, (item) =>
                    matches(item, vars) ? reconcileItem(item, res) : item,
                  ),
                )
              }
            }
            also?.onSuccess?.(qc, res)
          },
        }
      : {}),
    ...(invalidate && invalidate.length > 0
      ? {
          onSettled: () => {
            for (const k of invalidate) void qc.invalidateQueries({ queryKey: k })
          },
        }
      : {}),
  }
}
