import { useQuery } from "@tanstack/react-query"
import type { EventAnalyticsScope, GetEventAnalyticsResponse } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export const EVENT_ANALYTICS_STALE_MS = 60_000

export function useEventAnalytics(
  cleanupId: string | undefined,
  scope: EventAnalyticsScope,
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  return useQuery<GetEventAnalyticsResponse>({
    queryKey: queryKeys.eventAnalytics(cleanupId ?? "unknown", scope),
    enabled: !!cleanupId && (opts.enabled ?? true),
    queryFn: () => api.getEventAnalytics({ id: cleanupId as string, scope }),
    staleTime: EVENT_ANALYTICS_STALE_MS,
    placeholderData: (previous) => previous,
    retry: false,
  })
}
