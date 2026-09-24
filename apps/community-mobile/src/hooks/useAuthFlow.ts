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

export function useEnabledProviders() {
  return useQuery<OAuthProvider[]>({
    queryKey: ["auth", "providers"],
    queryFn: async () => {
      // The welcome screen waits on this before showing its buttons, so a silent backend must not hold it
      // for the ~60s socket timeout. AbortSignal.timeout is not guaranteed in Hermes.
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const session: SessionCheckResponse = await api.session({ signal: controller.signal })
        return session.enabledProviders ?? ["apple", "google", "email"]
      } finally {
        clearTimeout(timeout)
      }
    },
    retry: 0,
    staleTime: 5 * 60_000,
    placeholderData: ["apple", "google", "email"],
  })
}

async function persistSession(session: SessionResponse): Promise<void> {
  if (!session.token) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Sign-in did not return a token. Please try again.",
    )
  }
  await useAuthStore.getState().signIn(session.token, session.user)
}

export async function signInWithApple(input: AppleSignInRequest): Promise<void> {
  const session = await api.appleSignIn(input)
  await persistSession(session)
}

export async function signInWithGoogle(input: GoogleSignInRequest): Promise<void> {
  const session = await api.googleSignIn(input)
  await persistSession(session)
}

export async function requestEmailOtp(input: EmailOtpRequestRequest): Promise<number> {
  const res = await api.otpRequest(input)
  return res.resendAfterSec
}

export async function verifyEmailOtp(input: EmailOtpVerifyRequest): Promise<void> {
  const session = await api.otpVerify(input)
  await persistSession(session)
}
