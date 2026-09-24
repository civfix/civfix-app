import { useEffect, useState } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import { type LatLng } from "@civfix/shared/geocode"
import { useApi, fetchApproximateLocation, queryKeys } from "../../data"
import { useGeolocation } from "../../capabilities"
import { DEVICE_FIX_TIMEOUT_MS, withTimeout } from "../../data/deviceFix"

async function resolveApproxCenter(
  geo: ReturnType<typeof useGeolocation>,
  api: ApiClient,
  qc: QueryClient,
): Promise<LatLng | null> {
  const fix = geo.isAvailable() ? await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS) : null
  if (fix) return { lat: fix.latitude, lng: fix.longitude }
  const approximate = await fetchApproximateLocation(api, qc)
  if (approximate) return approximate
  return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null
}

export interface ApproxCenter {
  center: LatLng | null
  /** The current resolution attempt finished without a point; the pickers then ask for an address. */
  settled: boolean
}

// `refreshIfNull` is the picker being open: a session-cached null (denied, or offline) is resolved again
// then, so a permission granted since can place the map. A cached point is never re-resolved or replaced.
export function useApproxCenter(enabled: boolean, refreshIfNull: boolean): ApproxCenter {
  const geo = useGeolocation()
  const api = useApi()
  const qc: QueryClient = useQueryClient()
  const [center, setCenter] = useState<LatLng | null>(
    () => qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null,
  )
  const [settledFor, setSettledFor] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled || center) return
    const cached = qc.getQueryData<LatLng | null>(queryKeys.userLocation)
    if (cached) {
      setCenter(cached)
      return
    }
    let cancelled = false
    const settle = (c: LatLng | null) => {
      if (cancelled) return
      if (c) setCenter(c)
      else setSettledFor(refreshIfNull)
    }
    void qc
      .fetchQuery<LatLng | null>({
        queryKey: queryKeys.userLocation,
        queryFn: () => resolveApproxCenter(geo, api, qc),
        staleTime: refreshIfNull ? 0 : Infinity,
        gcTime: Infinity,
        retry: false,
      })
      .then(settle, () => settle(null))
    return () => {
      cancelled = true
    }
  }, [geo, api, qc, enabled, center, refreshIfNull])
  return { center, settled: enabled && center === null && settledFor === refreshIfNull }
}
