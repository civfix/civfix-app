import { useQuery } from "@tanstack/react-query"
import type { HostedEventsAnalyticsResponse, PortfolioAnalyticsRange } from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

export function useHostedEventsAnalytics(
  range: PortfolioAnalyticsRange = "30d",
  orgId: string | null = null,
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<HostedEventsAnalyticsResponse>({
    queryKey: queryKeys.hostedEventsAnalytics(range, orgId),
    enabled: isAuthenticated,
    queryFn: () => api.hostedEventsAnalytics({ range, ...(orgId ? { orgId } : {}) }),
    retry: false,
  })
}
