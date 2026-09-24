import { useQuery } from "@tanstack/react-query"
import { ErrorCode, appErrorCode } from "@civfix/shared"
import type { GetApproximateLocationResponse } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export const APPROXIMATE_LOCATION_STALE_MS = 60 * 60 * 1000

// A per-query `retry` replaces the host QueryClient's default cap, so the bound has to live here.
export const APPROXIMATE_LOCATION_RETRY_LIMIT = 2

const PERMANENT: readonly ErrorCode[] = [
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
]

export function approximateLocationShouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= APPROXIMATE_LOCATION_RETRY_LIMIT) return false
  const code = appErrorCode(error)
  if (code !== undefined && PERMANENT.includes(code)) return false
  return true
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
    retry: approximateLocationShouldRetry,
    refetchOnWindowFocus: false,
  })
}
