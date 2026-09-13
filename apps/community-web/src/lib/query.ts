"use client"

import { QueryClient } from "@tanstack/react-query"
import { AppError, ErrorCode } from "@civfix/shared"

/**
 * Create a React Query client tuned for a public, runtime-fetching SPA.
 *
 * Retries are conservative: we never retry 4xx (validation/auth/not-found) and only retry transient
 * failures (network/5xx) a couple of times. This keeps the UI responsive when the backend is down
 * (it fails fast into an error state instead of hammering a dead endpoint).
 *
 * Caching is aggressive to pair with the persisted cache (lib/query-persist): a 5-minute default
 * `staleTime` is what keeps a screen the user returns to from refetching (and visibly reloading) content
 * it already has - a remount is not a reason to refetch. Freshness comes from an explicit signal instead:
 * a mutation's own invalidation, the realtime channel for the families it covers, and a short local
 * `staleTime` on the volatile ones that override this default. A 24h `gcTime` matches the persisted
 * entries' max age so a warm entry is not garbage-collected out from under the next restore.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        // 24h serves the persisted, user-scoped families (so a warm entry survives until the next
        // restore); volatile, non-persisted queries (map, chat history, search) override this locally
        // with a short gcTime so they are reaped on their old schedule rather than held for 24h.
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof AppError) {
            const noRetry: ErrorCode[] = [
              ErrorCode.UNAUTHORIZED,
              ErrorCode.FORBIDDEN,
              ErrorCode.NOT_FOUND,
              ErrorCode.VALIDATION,
            ]
            if (noRetry.includes(error.code)) return false
          }
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * The CANONICAL query-key factory now lives in @civfix/ui/data (`src/data/keys.ts`) and is re-exported
 * here so the existing `@/lib/query` import sites keep working.
 *
 * The web app used to keep its own full copy, which had already drifted from the shared one (its
 * `cleanups(when)` key carried no `limit` segment, so a sidebar preview and the browse list collided on
 * one entry, and it kept an `inboxThreads` variant the shared factory collapsed into `threads`). Because
 * shared hooks invalidate via the shared keys and host hooks invalidated via these, a cross-layer
 * invalidation could silently miss a cache. There is now exactly ONE key namespace: add a new family in
 * @civfix/ui/data/keys.ts, never here and never at a call site.
 */
export { queryKeys } from "@civfix/ui/data"
