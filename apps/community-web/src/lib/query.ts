"use client"

import { QueryClient } from "@tanstack/react-query"
import { toAppError } from "@civfix/shared"

/**
 * Retries are conservative so the UI fails fast into an error state when the backend is down instead
 * of hammering a dead endpoint.
 *
 * The 5-minute default `staleTime` keeps a screen the user returns to from refetching content it
 * already has; freshness comes from explicit signals instead (a mutation's invalidation, the realtime
 * channel, and a short local `staleTime` on volatile families).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        // Matches the persisted entries' max age so a warm entry survives until the next restore;
        // volatile, non-persisted queries (map, chat history, search) override it with a short gcTime.
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: false,
        // Structural, not instanceof: a second @civfix/shared copy (vitest, a mis-deduped bundle)
        // throws a foreign-realm AppError. toAppError maps a network failure to INTERNAL (500), so
        // only transport and server faults retry; every 4xx (including 429) fails fast.
        retry: (failureCount, error) => toAppError(error).httpStatus >= 500 && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/** The single key namespace lives in @civfix/ui/data; add a family there, never here or at a call site. */
export { queryKeys } from "@civfix/ui/data"
