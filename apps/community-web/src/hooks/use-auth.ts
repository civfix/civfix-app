"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ErrorCode } from "@civfix/shared"

import { api, isAppErrorLike } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { clearPersistedCache } from "@/lib/query-persist"
import { useAuthStore, selectIsAuthenticated, selectAuthResolved } from "@/store/auth-store"
import { useSignOutRetryStore } from "@/store/sign-out-retry-store"

/**
 * Queries whose result depends on the viewer's identity. On sign-in/sign-out we invalidate only
 * these (not every cached query) so a fresh public surface like the map does not refetch needlessly
 * and a flaky backend is not hit with a thundering herd. Each key is a PREFIX so all variants match
 * (e.g. every `myReports(limit)` and `notifications(limit)`, every per-id profile/report/cleanup that
 * carries viewer-specific `mine`/`following` flags).
 */
const AUTH_DEPENDENT_KEYS: readonly (readonly unknown[])[] = [
  queryKeys.myReportsRoot,
  // ["threads"] is a PREFIX of every inbox variant, so this one entry covers the whole family.
  queryKeys.threads,
  queryKeys.notificationsRoot,
  queryKeys.notificationPrefs,
  ["profile"],
  ["report"],
  ["cleanup"],
  ["chat"],
  ["volunteer"],
]

function invalidateAuthDependentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  return Promise.all(
    AUTH_DEPENDENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined)
}

/**
 * Read-side auth hooks plus a session refresh used by the auth modal after a successful sign-in.
 */

export function useIsAuthenticated(): boolean {
  return useAuthStore(selectIsAuthenticated)
}

/** True once the session check has reached a terminal answer (authenticated or anonymous). */
export function useAuthResolved(): boolean {
  return useAuthStore(selectAuthResolved)
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}

/**
 * Refresh the auth store from GET /auth/session. Returns a callback the auth modal calls after the
 * OAuth/OTP flow completes so the UI reflects the new session and protected queries can refetch.
 */
export function useRefreshSession() {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)
  const setAnonymous = useAuthStore((s) => s.setAnonymous)
  const queryClient = useQueryClient()

  return React.useCallback(async () => {
    setStatus("loading")
    try {
      const res = await api.session()
      if (res.authenticated && res.user) {
        // Thread the CSRF token so the OAuth-return refresh recovers it. The store preserves any
        // previously captured token when this response omits one. enabledProviders drives the modal.
        setSession({
          user: res.user,
          csrfToken: res.csrfToken,
          roles: res.roles,
          enabledProviders: res.enabledProviders,
          guestSmsEnabled: res.guestSmsEnabled,
        })
      } else {
        setSession({
          user: null,
          roles: res.roles ?? [],
          enabledProviders: res.enabledProviders,
          guestSmsEnabled: res.guestSmsEnabled,
        })
      }
      // Let protected queries (reports/threads/notifications/profiles) refetch under the new identity.
      // Scoped to the auth-dependent keys so public surfaces (map pins, cleanups) are not refetched.
      await invalidateAuthDependentQueries(queryClient)
      return res.authenticated
    } catch {
      // The refresh never reached a live answer. Fall back to the signed-out UI, but through
      // setAnonymous so `user` is cleared with the status (a bare setStatus would leave the stale
      // profile readable through useCurrentUser while useIsAuthenticated reports false).
      setAnonymous()
      return false
    }
  }, [setSession, setStatus, setAnonymous, queryClient])
}

/**
 * POST /auth/logout. True when the server ended the session, or it had already ended (UNAUTHORIZED).
 * Any other failure leaves the httpOnly cookie valid. No header is passed: the client's CSRF resolver
 * reads the token at call time, after the boot-time session check has settled.
 */
async function revokeServerSession(): Promise<boolean> {
  try {
    await api.logout()
    return true
  } catch (err) {
    return isAppErrorLike(err) && err.code === ErrorCode.UNAUTHORIZED
  }
}

/**
 * Sign the user out: POST /auth/logout (CSRF-protected), then clear local state. Never rejects (callers
 * `void` it). Fails closed: while the server has not ended the session the cookie would sign the user
 * straight back in on reload, so a failed POST keeps them visibly signed in and raises the retry notice.
 */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()

  return React.useCallback(async () => {
    const signOut = useSignOutRetryStore.getState()
    if (!signOut.begin()) return
    const revoked = await revokeServerSession()
    signOut.finish(revoked)
    if (!revoked) return
    clear()
    // Shared-device safety: wipe the persisted query cache and the in-memory cache so the previous
    // user's lists can never paint for the next person on this browser. The next load is cold.
    clearPersistedCache()
    queryClient.clear()
  }, [clear, queryClient])
}
