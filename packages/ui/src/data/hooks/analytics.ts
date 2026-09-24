import { useQuery } from "@tanstack/react-query"
import type {
  AnalyticsRange,
  EventAnalyticsScope,
  GetEventAnalyticsResponse,
  HostAnalyticsSummaryResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

const EVENT_ANALYTICS_STALE_MS = 60_000

const HOST_ANALYTICS_SUMMARY_RANGE: AnalyticsRange = "30d"

export function useHostAnalyticsSummary(
  orgId: string | null,
  range: AnalyticsRange = HOST_ANALYTICS_SUMMARY_RANGE,
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<HostAnalyticsSummaryResponse>({
    queryKey: queryKeys.hostAnalyticsSummary(range, orgId),
    enabled: isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.hostedEventsAnalyticsSummary({ range, ...(orgId ? { orgId } : {}) }),
    staleTime: EVENT_ANALYTICS_STALE_MS,
    placeholderData: (previous) => previous,
    retry: false,
  })
}

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
