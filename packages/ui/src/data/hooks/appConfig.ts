import { useQuery } from "@tanstack/react-query"
import type { AppConfigResponse } from "@civfix/contract"
import { useApi } from "../context"
import { queryKeys } from "../keys"

const APP_CONFIG_STALE_MS = 5 * 60 * 1000

// Fresh for five minutes, so a return to the foreground refetches only once that has passed; sign-in
// invalidates it and sign-out clears the cache, so a staging override shows at once either way.
export function useAppConfig() {
  const api = useApi()
  return useQuery<AppConfigResponse>({
    queryKey: queryKeys.appConfig,
    queryFn: () => api.getAppConfig(),
    staleTime: APP_CONFIG_STALE_MS,
    refetchOnWindowFocus: true,
  })
}
