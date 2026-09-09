"use client"

import { useQuery } from "@tanstack/react-query"
import type { ListEventTeamResponse } from "@civfix/shared"
import { useApi, queryKeys } from "@civfix/ui/data"

export function useConsoleTeam(eventId: string) {
  const api = useApi()
  return useQuery<ListEventTeamResponse>({
    queryKey: [...queryKeys.hostTeam(eventId), "console"],
    enabled: eventId.length > 0,
    queryFn: () => api.listEventTeam({ id: eventId }),
    retry: false,
  })
}
