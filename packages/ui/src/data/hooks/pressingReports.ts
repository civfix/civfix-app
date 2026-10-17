import { useQuery } from "@tanstack/react-query"
import type { BBox, ReportPinDTO } from "@civfix/contract"
import { useApi } from "../context"
import { queryKeys } from "../keys"

const PRESSING_STALE_MS = 60_000

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
