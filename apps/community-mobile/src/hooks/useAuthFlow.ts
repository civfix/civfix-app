import { useQuery } from "@tanstack/react-query"
import type { SessionCheckResponse, OAuthProvider } from "@civfix/shared"
import { api } from "@/api/client"
import { withRequestDeadline } from "@/api/deadline"

// The welcome screen waits on this before showing its buttons, so a silent backend must not hold it for
// the ~60s socket timeout.
const AUTH_PROVIDERS_DEADLINE_MS = 6000

const PROVIDERS_STALE_MS = 5 * 60_000

export const ALL_OAUTH_PROVIDERS: readonly OAuthProvider[] = ["apple", "google", "email"]

export function useEnabledProviders() {
  return useQuery<OAuthProvider[]>({
    queryKey: ["auth", "providers"],
    queryFn: async () => {
      const session: SessionCheckResponse = await withRequestDeadline(
        AUTH_PROVIDERS_DEADLINE_MS,
        (signal) => api.session({ signal }),
      )
      return session.enabledProviders ?? [...ALL_OAUTH_PROVIDERS]
    },
    retry: 0,
    staleTime: PROVIDERS_STALE_MS,
    placeholderData: [...ALL_OAUTH_PROVIDERS],
  })
}
