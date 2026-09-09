import { useQuery } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import type { GetEventIcsResponse } from "@civfix/shared"
import { useApi } from "./context"
import { queryKeys } from "./keys"

export function fetchEventIcs(api: ApiClient, id: string): Promise<GetEventIcsResponse> {
  return api.getEventIcs({ id })
}

export function useEventIcs(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery<GetEventIcsResponse>({
    queryKey: queryKeys.eventIcs(id ?? "unknown"),
    enabled: !!id && (opts.enabled ?? true),
    queryFn: () => fetchEventIcs(api, id as string),
    retry: false,
  })
}
