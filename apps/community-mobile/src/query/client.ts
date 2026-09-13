import { QueryClient } from "@tanstack/react-query"
import { isRetryableError } from "@/lib/errors"
import { PERSISTED_QUERY_KEYS } from "@/query/cache-policy"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => isRetryableError(error) && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
})

for (const queryKey of PERSISTED_QUERY_KEYS) {
  queryClient.setQueryDefaults(queryKey, { refetchOnWindowFocus: "always" })
}
