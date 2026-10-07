import type {
  SessionResponse,
  AppleSignInRequest,
  GoogleSignInRequest,
  EmailOtpRequestRequest,
  EmailOtpVerifyRequest,
} from "@civfix/shared"
import { AppError, ErrorCode } from "@civfix/shared"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"

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
