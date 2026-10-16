import { useQuery } from "@tanstack/react-query"
import type { BBox, ReportPinDTO } from "@civfix/contract"
import { useApi } from "../context"
import { queryKeys } from "../keys"
import { PICKER_BBOX_PAD_DEG, roundPickerCoord } from "./reports"

const PRESSING_STALE_MS = 60_000

/** The "Reports nearby" area around a point, so both Search sections cover the same ground. */
export function nearbyPinsBbox(point: { lat: number; lng: number } | null): BBox | null {
  if (!point) return null
  const lat = roundPickerCoord(point.lat)
  const lng = roundPickerCoord(point.lng)
  return {
    west: lng - PICKER_BBOX_PAD_DEG,
    east: lng + PICKER_BBOX_PAD_DEG,
    south: lat - PICKER_BBOX_PAD_DEG,
    north: lat + PICKER_BBOX_PAD_DEG,
  }
}

// Keyed under ["map", "reports"] so a Me too's invalidation refreshes the ranking too.
export function usePressingReports(bbox: BBox | null) {
  const api = useApi()
  return useQuery<ReportPinDTO[]>({
    queryKey: queryKeys.pressingReports(bbox),
    enabled: bbox !== null,
    queryFn: async ({ signal }) => {
      const res = await api.pressingReports({ bbox: bbox as BBox }, { signal })
      return Array.isArray(res?.items) ? res.items : []
    },
    retry: false,
    staleTime: PRESSING_STALE_MS,
  })
}
