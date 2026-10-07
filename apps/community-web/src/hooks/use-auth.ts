"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ErrorCode, isAppErrorLike } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { clearPersistedCache } from "@/lib/query-persist"
import {
  isConfirmedSignedOut,
  useAuthStore,
  selectIsAuthenticated,
  selectAuthResolved,
  SESSION_SETTLE_TIMEOUT_MS,
} from "@/store/auth-store"
import { useSignOutRetryStore } from "@/store/sign-out-retry-store"

/**
 * Only these are invalidated on sign-in/sign-out, so public surfaces like the map do not refetch and a
 * flaky backend is not hit with a thundering herd. Each key is a prefix that matches every variant.
 */
const AUTH_DEPENDENT_KEYS: readonly (readonly unknown[])[] = [
  queryKeys.myReportsRoot,
  queryKeys.threads,
  queryKeys.notificationsRoot,
  queryKeys.profileRoot,
  // Feeds, replies, saves and post details carry the viewer's liked/saved/reposted flags.
  queryKeys.postsRoot,
  queryKeys.postRoot,
  queryKeys.reportRoot,
  queryKeys.cleanupRoot,
  queryKeys.chatRoot,
  ["volunteer"],
]

function invalidateAuthDependentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  return Promise.all(
    AUTH_DEPENDENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined)
}

export function useIsAuthenticated(): boolean {
  return useAuthStore(selectIsAuthenticated)
}

export function useAuthResolved(): boolean {
  return useAuthStore(selectAuthResolved)
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}

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
        // Threads the CSRF token so the OAuth-return refresh recovers it; the store keeps a previously
        // captured token when this response omits one.
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
      await invalidateAuthDependentQueries(queryClient)
      return res.authenticated
    } catch {
      // setAnonymous, not a bare setStatus: `user` must clear with the status, or the stale profile
      // stays readable through useCurrentUser while useIsAuthenticated reports false.
      setAnonymous()
      return false
    }
  }, [setSession, setStatus, setAnonymous, queryClient])
}

/**
 * How long a sign-out waits for POST /auth/logout before giving up and offering the retry. The CSRF
 * resolver may first wait out the boot-time session check (SESSION_SETTLE_TIMEOUT_MS), so the deadline
 * covers that wait plus a slow request.
 */
export const SIGN_OUT_DEADLINE_MS = SESSION_SETTLE_TIMEOUT_MS + 7_000

/**
 * POST /auth/logout. True when the server ended the session, or it had already ended (UNAUTHORIZED).
 * Any other failure, the deadline included, leaves the httpOnly cookie valid. No header is passed: the
 * client's CSRF resolver reads the token at call time, after the boot-time session check has settled.
 */
function revokeServerSession(): Promise<boolean> {
  const controller = new AbortController()
  return new Promise<boolean>((resolve) => {
    const deadline = setTimeout(() => {
      controller.abort()
      resolve(false)
    }, SIGN_OUT_DEADLINE_MS)
    api.logout({ signal: controller.signal }).then(
      () => {
        clearTimeout(deadline)
        resolve(true)
      },
      (err: unknown) => {
        clearTimeout(deadline)
        resolve(isAppErrorLike(err) && err.code === ErrorCode.UNAUTHORIZED)
      },
    )
  })
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
    // A 401 elsewhere may have signed the user out while this request hung: nothing is left to retry.
    signOut.finish(revoked || isConfirmedSignedOut(useAuthStore.getState()))
    if (!revoked) return
    clear()
    // Shared-device safety: the previous user's lists must never paint for the next person here.
    clearPersistedCache()
    queryClient.clear()
  }, [clear, queryClient])
}
