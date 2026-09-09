/**
 * Shared moderation / account-management hooks - the App-Store-audit remediation surface (content
 * reporting, self-service account deletion, and a data-export request). Authored framework-light: the
 * host API client + auth/logout via the injected data context, no expo / next / Alert / store imports.
 *
 *   useReportContent()  - POST /content-reports {subjectType,subjectId,reason,details?} -> {ok:true}. A
 *                         fire-and-forget content report against any UGC subject (report|comment|message|
 *                         event|profile|photo). No optimistic patch, no cache to invalidate - the body just
 *                         surfaces pending/success/error (shape mirrors useBlockUser).
 *   useDeleteAccount()  - DELETE /me -> {ok:true}, then the host `logout()` for session/cache teardown. A
 *                         SOFT delete server-side (the row + PII are kept for admin; sessions revoked, posts
 *                         kept; public projections render "Deleted User"). The host owns cache teardown, so
 *                         after the DELETE succeeds we call the injected `logout()` rather than clearing
 *                         caches here; the host's auth gate then re-routes to the signed-out state.
 *   useRequestMyData()  - POST /me/data-export -> {ok:true,email?}. Queues a data export delivered by email;
 *                         the optional echoed `email` lets the UI confirm the destination.
 */
import { useMutation } from "@tanstack/react-query"
import type {
  DeleteAccountResponse,
  EmailOtpRequestResponse,
  ReportContentRequest,
  ReportContentResponse,
  RequestDataExportResponse,
} from "@civfix/shared"
import { useApi, useLogout } from "../context"

/**
 * File a content report against a UGC subject (POST /content-reports, auth-required + CSRF). Fire-and-forget:
 * there is no read cache to invalidate, so the hook just surfaces `isPending`/`isSuccess`/`error` for the
 * report sheet. The mutation variable is the full request body `{subjectType, subjectId, reason, details?}`.
 */
export function useReportContent() {
  const api = useApi()
  return useMutation<ReportContentResponse, unknown, ReportContentRequest>({
    mutationFn: (input: ReportContentRequest) => api.reportContent(input),
  })
}

/**
 * Email a one-time verification code to an address (POST /auth/otp/request, public). Reused OUTSIDE
 * sign-in to re-prove email control before a sensitive action (here: account deletion). Returns the
 * `resendAfterSec` cooldown so the caller can disable "Resend" until it elapses. The mutation variable is
 * the destination email (the account's own email, from the session user).
 */
export function useRequestEmailCode() {
  const api = useApi()
  return useMutation<EmailOtpRequestResponse, unknown, { email: string }>({
    mutationFn: ({ email }) => api.otpRequest({ email }),
  })
}

/**
 * Self-service account deletion (DELETE /me, auth-required + CSRF). Gated by an email OTP: the caller first
 * requests a code via {@link useRequestEmailCode}, then passes the 6-digit `emailOtp` here; the server
 * verifies it before the (soft) delete, so an idle/stolen session can't delete the account without the
 * email inbox. On success we call the host-injected `logout()` so the host tears down the session + caches
 * and re-routes to the signed-out state. Deletion teardown is the host's job - never clear caches here.
 */
export function useDeleteAccount() {
  const api = useApi()
  const logout = useLogout()
  return useMutation<DeleteAccountResponse, unknown, { emailOtp: string }>({
    mutationFn: ({ emailOtp }) => api.deleteAccount({ emailOtp }),
    onSuccess: () => {
      void logout()
    },
  })
}

/**
 * Request a copy of the account's data (POST /me/data-export, auth-required + CSRF). The server queues an
 * export delivered by email and (optionally) echoes the destination address so the UI can confirm where the
 * copy is going. No cache to invalidate - the hook just surfaces pending/success/error + the echoed email.
 */
export function useRequestMyData() {
  const api = useApi()
  return useMutation<RequestDataExportResponse, unknown, void>({
    mutationFn: () => api.requestDataExport(),
  })
}
