"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { clearPersistedCache } from "@/lib/query-persist"
import { useAuthStore } from "@/store/auth-store"

/**
 * Retries for a session check that failed on the network while an optimistic snapshot is on screen:
 * enough to ride out a blip or a backend restart, after which the page renders signed-out.
 */
const RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000, 8_000]

/**
 * Hydrates the auth store from GET /auth/session once on mount.
 *
 * A network failure is not an answer: with an optimistic snapshot on screen the viewer is probably still
 * signed in, and dropping them to the anonymous UI on one blip cannot be undone without a reload. So the
 * failure path retries while the state is optimistic, then falls back via `setAnonymous`, which clears
 * `user` with the status so the two never disagree.
 *
 * Shared-device safety: the persisted cache and the snapshot belong to whoever last signed in on this
 * browser. If the live session is a different user, both caches are purged before the new session applies
 * so user A's lists never paint for user B. query-persist.restore() is the primary guard at boot; this
 * covers a snapshot that went stale after it.
 */
export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)
  const setAnonymous = useAuthStore((s) => s.setAnonymous)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    // Captured before the live session reconciles; a live user id that differs is a user switch.
    const lastSeenUserId = useAuthStore.getState().user?.id ?? null
    // On an optimistic boot the header already shows the avatar; "loading" would blink it to a skeleton
    // and back, so the session result reconciles the optimistic state instead.
    if (!useAuthStore.getState().optimistic) {
      setStatus("loading")
    }

    const applySession = (res: Awaited<ReturnType<typeof api.session>>): void => {
      if (res.authenticated && res.user) {
        if (lastSeenUserId !== null && lastSeenUserId !== res.user.id) {
          clearPersistedCache()
          queryClient.clear()
        }
        // A page reload and the OAuth redirect return both land here, so this is where they recover
        // the CSRF token for signed-in mutations.
        setSession({
          user: res.user,
          csrfToken: res.csrfToken,
          roles: res.roles,
          enabledProviders: res.enabledProviders,
          guestSmsEnabled: res.guestSmsEnabled,
        })
        return
      }
      setSession({
        user: null,
        roles: res.roles ?? [],
        enabledProviders: res.enabledProviders,
        guestSmsEnabled: res.guestSmsEnabled,
      })
    }

    const attempt = (retry: number): void => {
      api
        .session()
        .then((res) => {
          if (cancelled) return
          applySession(res)
        })
        .catch(() => {
          if (cancelled) return
          // With an optimistic snapshot the cookie is probably fine, and going anonymous would also
          // strand the viewer without a CSRF token, so retry. With no snapshot there is nothing to
          // protect: render signed-out at once.
          const delay = RETRY_DELAYS_MS[retry]
          if (delay !== undefined && useAuthStore.getState().optimistic) {
            retryTimer = setTimeout(() => attempt(retry + 1), delay)
            return
          }
          setAnonymous()
        })
    }
    attempt(0)

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [setSession, setStatus, setAnonymous, queryClient])

  return null
}
