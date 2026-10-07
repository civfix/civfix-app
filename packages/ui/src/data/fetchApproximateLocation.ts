import type { QueryClient } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import type { GetApproximateLocationResponse, LatLng } from "@civfix/shared"
import { queryKeys } from "./keys"
import {
  APPROXIMATE_LOCATION_STALE_MS,
  approximateLocationShouldRetry,
} from "./hooks/approximateLocation"

export async function fetchApproximateLocation(
  api: ApiClient,
  qc: QueryClient,
): Promise<LatLng | null> {
  const cached = qc.getQueryData<GetApproximateLocationResponse>(queryKeys.approximateLocation)
  if (cached) return { lat: cached.lat, lng: cached.lng }
  try {
    const resolved = await qc.fetchQuery<GetApproximateLocationResponse>({
      queryKey: queryKeys.approximateLocation,
      queryFn: () => api.getApproximateLocation({}),
      staleTime: APPROXIMATE_LOCATION_STALE_MS,
      gcTime: APPROXIMATE_LOCATION_STALE_MS,
      retry: approximateLocationShouldRetry,
    })
    return { lat: resolved.lat, lng: resolved.lng }
  } catch {
    return null
  }
}
