import { useQuery } from "@tanstack/react-query"
import { AppError, ErrorCode } from "@civfix/shared"
import type { GetApproximateLocationResponse } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export const APPROXIMATE_LOCATION_STALE_MS = 60 * 60 * 1000

const PERMANENT: readonly ErrorCode[] = [
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
]

export function approximateLocationShouldRetry(_failureCount: number, error: unknown): boolean {
  if (error instanceof AppError && PERMANENT.includes(error.code)) return false
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
