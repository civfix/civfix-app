import { useQuery } from "@tanstack/react-query"
import type { GetApproximateLocationResponse } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export const APPROXIMATE_LOCATION_STALE_MS = 60 * 60 * 1000

export const APPROXIMATE_LOCATION_RETRY_BASE_MS = 1000

export const APPROXIMATE_LOCATION_RETRY_MAX_MS = 30_000

export function approximateLocationRetryDelay(attemptIndex: number): number {
  return Math.min(
    APPROXIMATE_LOCATION_RETRY_MAX_MS,
    APPROXIMATE_LOCATION_RETRY_BASE_MS * 2 ** attemptIndex,
  )
}

export interface UseApproximateLocationOptions {
  enabled?: boolean
}

export function useApproximateLocation(opts: UseApproximateLocationOptions = {}) {
  const api = useApi()
  return useQuery<GetApproximateLocationResponse>({
    queryKey: queryKeys.approximateLocation,
    enabled: opts.enabled ?? true,
    queryFn: () => api.getApproximateLocation({}),
    staleTime: APPROXIMATE_LOCATION_STALE_MS,
    gcTime: APPROXIMATE_LOCATION_STALE_MS,
    retry: true,
    retryDelay: approximateLocationRetryDelay,
    refetchOnWindowFocus: false,
  })
}
