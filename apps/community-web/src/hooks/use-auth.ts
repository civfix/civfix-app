"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { clearPersistedCache } from "@/lib/query-persist"
import { useAuthStore, selectIsAuthenticated, selectAuthResolved } from "@/store/auth-store"

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
  queryKeys.profileRoot,
  // Feeds, replies, saves and post details carry the viewer's liked/saved/reposted flags.
  queryKeys.postsRoot,
  queryKeys.postRoot,
  queryKeys.reportRoot,
  queryKeys.cleanupRoot,
  queryKeys.chatRoot,
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

/** Sign the user out: POST /auth/logout (CSRF-protected), then clear local state. */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()

  return React.useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Even if the call fails (already expired, backend down), drop local state.
    }
    clear()
    // Fail-closed (shared-device safety): wipe the persisted query cache and the in-memory cache so the
    // previous user's lists can never paint for the next person on this browser. The next load is cold.
    clearPersistedCache()
    queryClient.clear()
  }, [clear, queryClient])
}
