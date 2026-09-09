/**
 * Shared React Query hook for verification - the data wiring behind the own-profile "Get verified"
 * affordance + the unverified-host nudge. Framework-light: it reaches the host API client + auth state
 * through the injected data context (useApi / useAuthState), uses the SHARED queryKeys, and never imports
 * expo / next / a store.
 *
 *   useMyVerification() - GET /me/verification (auth REQUIRED) -> { verification: { status } }. Drives the
 *                         "Verified community organizer" mark vs the "Get verified" CTA. Gated on `isAuthenticated`
 *                         so a signed-out viewer never fires a guaranteed-401 (matches useMyProfile).
 *
 * There is no apply mutation: getting verified happens via a scheduled call with the founder (an external
 * link surfaced by GetVerifiedBody), and an operator marks the account verified from the admin Users
 * section. Nothing the client POSTs changes verification status.
 */
import { useQuery } from "@tanstack/react-query"
import type { GetMyVerificationResponse } from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

/**
 * GET /me/verification - the signed-in viewer's own verification state ({ status }). Auth-REQUIRED, so it
 * is gated on `isAuthenticated` (web's posture) and never fires a guaranteed-401 while signed out / still
 * resolving. Retries off so the profile affordance paints promptly.
 */
export function useMyVerification() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<GetMyVerificationResponse>({
    queryKey: queryKeys.myVerification,
    enabled: isAuthenticated,
    queryFn: () => api.myVerification(),
    retry: false,
  })
}
