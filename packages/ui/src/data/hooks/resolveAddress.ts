import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import type { ResolveAddressResponse } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { geocodePointKey } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export interface ResolveAddressPoint {
  lat: number
  lng: number
}

const RESOLVED_ADDRESS_STALE_MS = 24 * 60 * 60 * 1000

export async function fetchResolvedAddress(
  api: Pick<ApiClient, "resolveAddress">,
  point: ResolveAddressPoint,
): Promise<ResolveAddressResponse | null> {
  try {
    const res = await api.resolveAddress({ lat: point.lat, lng: point.lng })
    const address = res.address?.trim() ?? ""
    return {
      address: address.length > 0 ? address : null,
      precision: res.precision ?? null,
      cityStateLabel: res.cityStateLabel?.trim() ?? "",
    }
  } catch {
    return null
  }
}

export function useResolveAddress(
  point: ResolveAddressPoint | null,
  opts?: { enabled?: boolean },
): UseQueryResult<ResolveAddressResponse | null> {
  const api = useApi()
  const key = point ? geocodePointKey(point) : "none"
  const enabled = point !== null && opts?.enabled !== false
  return useQuery<ResolveAddressResponse | null>({
    queryKey: queryKeys.resolvedAddress(key),
    enabled,
    queryFn: () => fetchResolvedAddress(api, point!),
    retry: false,
    staleTime: RESOLVED_ADDRESS_STALE_MS,
    gcTime: RESOLVED_ADDRESS_STALE_MS,
  })
}
