/**
 * Sign-in data hooks: which providers the server has enabled, and the three sign-in mutations
 * (Apple, Google, email OTP request + verify). Each mutation stores the returned bearer token via
 * the auth store (which writes it to the device keychain) and sets the user, then the screen routes
 * home. All mobile sign-in responses carry the bearer in the body (SessionResponse.token); we never
 * rely on a cookie on mobile.
 */
import { useQuery } from "@tanstack/react-query"
import type {
  SessionCheckResponse,
  SessionResponse,
  OAuthProvider,
  AppleSignInRequest,
  GoogleSignInRequest,
  EmailOtpRequestRequest,
  EmailOtpVerifyRequest,
} from "@civfix/shared"
import { AppError, ErrorCode } from "@civfix/shared"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"

/**
 * GET /auth/session - used pre-sign-in to learn which providers are configured so we only show
 * buttons that will work. Resilient: a failure (offline / no backend) resolves to "show all".
 */
export function useEnabledProviders() {
  return useQuery<OAuthProvider[]>({
    queryKey: ["auth", "providers"],
    queryFn: async () => {
      // The welcome screen now WAITS on this request before revealing its sign-in buttons (so a
      // server-disabled provider can't flash in then vanish - issue #54), so it must never hang the
      // screen. Bound it with a short client-side timeout: a backend that accepts the socket then goes
      // silent (captive portal / overloaded server) aborts at 6s and falls back to "show all providers"
      // instead of leaving the user on a bare spinner for the platform's ~60s socket timeout. We use an
      // AbortController + setTimeout (not AbortSignal.timeout, which isn't guaranteed in Hermes) for
      // portability; the shared client forwards `signal` to fetch.
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const session: SessionCheckResponse = await api.session({ signal: controller.signal })
        return session.enabledProviders ?? ["apple", "google", "email"]
      } finally {
        clearTimeout(timeout)
      }
    },
    // Fall back to all providers if the check fails OR times out; never block the sign-in screen on it.
    retry: 0,
    staleTime: 5 * 60_000,
    placeholderData: ["apple", "google", "email"],
  })
}

/** Store a fresh SessionResponse (bearer + user) via the auth store, or throw if no token came back. */
async function persistSession(session: SessionResponse): Promise<void> {
  if (!session.token) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Sign-in did not return a token. Please try again.",
    )
  }
  await useAuthStore.getState().signIn(session.token, session.user)
}

/** POST /auth/apple with the Apple identity token; persists the bearer on success. */
export async function signInWithApple(input: AppleSignInRequest): Promise<void> {
  const session = await api.appleSignIn(input)
  await persistSession(session)
}

/** POST /auth/google with the Google id token; persists the bearer on success. */
export async function signInWithGoogle(input: GoogleSignInRequest): Promise<void> {
  const session = await api.googleSignIn(input)
  await persistSession(session)
}

/** POST /auth/otp/request - emails a 6-digit code. Returns the resend cooldown (seconds). */
export async function requestEmailOtp(input: EmailOtpRequestRequest): Promise<number> {
  const res = await api.otpRequest(input)
  return res.resendAfterSec
}

/** POST /auth/otp/verify - exchanges the code for a session; persists the bearer on success. */
export async function verifyEmailOtp(input: EmailOtpVerifyRequest): Promise<void> {
  const session = await api.otpVerify(input)
  await persistSession(session)
}
