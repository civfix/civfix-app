"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { clearPersistedCache } from "@/lib/query-persist"
import { useAuthStore } from "@/store/auth-store"

/**
 * Hydrates the auth store from GET /auth/session exactly once on mount.
 *
 * Resilient by design: if the backend is unreachable (dev / no server), the catch renders the
 * signed-out state instead of spinning forever. The session endpoint is `auth: optional`, so a 200
 * with `authenticated:false` is the normal signed-out path.
 *
 * A NETWORK failure is not an answer, though: when an optimistic snapshot is on screen the viewer is
 * probably still signed in (their httpOnly cookie is intact), and dropping them to the anonymous UI on
 * one blip is both wrong and unrecoverable without a reload. So the failure path retries on a short
 * backoff while the state is still optimistic, and only then falls back to signed-out - via
 * `setAnonymous`, which clears `user` along with the status so the two can never disagree.
 *
 * Fail-closed user-switch (shared-device safety): the persisted query cache and the optimistic
 * snapshot are display data for WHOEVER was last signed in on this browser. If the live session
 * resolves to a DIFFERENT user than the snapshot recorded, we purge the persisted + in-memory caches
 * BEFORE applying the new session so user A's cached lists never paint for user B. (Logout purges too;
 * this covers the case where a different user signs in without an explicit logout first.)
 *
 * This is now DEFENSE-IN-DEPTH: the primary user-switch guard is in query-persist.restore(), which
 * fails closed at boot (it only hydrates when the envelope's user id matches the optimistic snapshot,
 * BEFORE the warm paint). This purge still covers the window after the live session resolves to a
 * different identity than the snapshot - e.g. a snapshot that silently went stale.
 */
/**
 * Backoff schedule for retrying a session check that failed on the NETWORK while an optimistic
 * snapshot is on screen. Short and bounded: enough to ride out a blip / a backend restart, after which
 * we stop guessing and render the signed-out state.
 */
const RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000, 8_000]

export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)
  const setAnonymous = useAuthStore((s) => s.setAnonymous)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    // The user the optimistic snapshot / persisted cache belong to (the last user seen on this browser),
    // captured before the live session reconciles. A live user id that differs from this is a user-switch.
    const lastSeenUserId = useAuthStore.getState().user?.id ?? null
    // On an optimistic boot (snapshot present) the header is already showing the avatar; flipping to
    // "loading" would blink it avatar to skeleton to avatar. Leave the optimistic state on screen and let the
    // session result below reconcile it (to confirmed-authed, or to anonymous if the snapshot expired).
    if (!useAuthStore.getState().optimistic) {
      setStatus("loading")
    }

    const applySession = (res: Awaited<ReturnType<typeof api.session>>): void => {
      if (res.authenticated && res.user) {
        // User-switch: the live identity differs from the one the persisted cache belongs to. Purge
        // both caches before applying the new session so the previous user's data never shows.
        if (lastSeenUserId !== null && lastSeenUserId !== res.user.id) {
          clearPersistedCache()
          queryClient.clear()
        }
        // Thread the CSRF token from the session check so a page reload (and the OAuth redirect
        // return, which lands here) recovers it for signed-in mutations. enabledProviders drives the
        // auth modal's button set.
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
          // Backend down or network error. While the optimistic snapshot is still on screen this is a
          // GUESS we should not overturn on one failure (the cookie is probably fine, and going
          // anonymous would also strand the viewer without a CSRF token), so retry on a short backoff.
          // With no snapshot (dev / no server) there is nothing to protect: render signed-out at once.
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
