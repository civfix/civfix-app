import { useQuery } from "@tanstack/react-query"
import type { OAuthProvider } from "@civfix/shared"
import { sessionCheck } from "@/api/sessionCheck"

// The welcome screen waits on this before showing its buttons, so a silent backend must not hold it for
// the ~60s socket timeout.
const AUTH_PROVIDERS_DEADLINE_MS = 6000

const PROVIDERS_STALE_MS = 5 * 60_000

const ALL_OAUTH_PROVIDERS: readonly OAuthProvider[] = ["apple", "google", "email"]

function useEnabledProviders() {
  return useQuery<OAuthProvider[]>({
    queryKey: ["auth", "providers"],
    queryFn: async () => {
      const session = await sessionCheck(AUTH_PROVIDERS_DEADLINE_MS)
      return session.enabledProviders ?? [...ALL_OAUTH_PROVIDERS]
    },
    retry: 0,
    staleTime: PROVIDERS_STALE_MS,
    placeholderData: [...ALL_OAUTH_PROVIDERS],
  })
}

// Placeholder data stands in for the real list until the session answers, so "ready" means the
// server's list (or its fallback after a failure) has replaced it.
export function useSignInProviders(): { ready: boolean; enabled: readonly OAuthProvider[] } {
  const providers = useEnabledProviders()
  return {
    ready: !providers.isPlaceholderData,
    enabled: providers.data ?? ALL_OAUTH_PROVIDERS,
  }
}
