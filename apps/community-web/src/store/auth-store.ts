"use client"

import { create } from "zustand"
import type { UserDTO, OAuthProvider } from "@civfix/shared"

import { readAuthSnapshot, writeAuthSnapshot, clearAuthSnapshot } from "@/lib/auth-snapshot"

/**
 * The session cookie is httpOnly, so the only secret tracked here is the CSRF token mutations echo. The
 * API client reads it through getCsrfToken() at call time, which avoids a static import cycle.
 *
 * With an auth snapshot present the store boots `authenticated` with `optimistic: true` so the avatar
 * paints on the first frame while AuthHydrator revalidates. `optimistic` is orthogonal to
 * authenticated-vs-anonymous, so it is a flag rather than an AuthStatus value.
 */

export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous"

export interface AuthState {
  status: AuthStatus
  user: UserDTO | null
  csrfToken: string | null
  /** Roles from the session check (a user may hold more than one). Never sourced from the snapshot. */
  roles: string[]
  /** Restored from the snapshot and not yet confirmed by a live GET /auth/session. */
  optimistic: boolean
  /** Server config rather than user state, so it survives sign-out. */
  enabledProviders: OAuthProvider[]
  /**
   * Server config rather than user state, so it survives sign-out and a response that omits it. Undefined
   * until a live session answer arrives, which GuestRsvpSheet reads as email-only (the safe default).
   */
  guestSmsEnabled?: boolean

  setSession: (input: {
    user: UserDTO | null
    csrfToken?: string | null
    roles?: string[]
    enabledProviders?: OAuthProvider[]
    guestSmsEnabled?: boolean
  }) => void
  setStatus: (status: AuthStatus) => void
  /**
   * For a session check that failed on the network. It clears `user` so `status` and `user` never
   * disagree, but unlike `clear()` it keeps the CSRF token and the snapshot, so the next load can still
   * paint optimistically and retry the check.
   */
  setAnonymous: () => void
  clear: () => void
}

/** Exported so the optimistic-init logic is testable without resetting the store module. */
export function deriveInitialState(
  snapshotUser: UserDTO | null,
): Pick<AuthState, "status" | "user" | "optimistic"> {
  return snapshotUser
    ? { status: "authenticated", user: snapshotUser, optimistic: true }
    : { status: "idle", user: null, optimistic: false }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...deriveInitialState(readAuthSnapshot()),
  csrfToken: null,
  roles: [],
  enabledProviders: [],

  setSession: ({ user, csrfToken, roles, enabledProviders, guestSmsEnabled }) => {
    // The one write that keeps the snapshot in lockstep with the displayed user on every path. It holds
    // the user's own non-secret profile, never the token.
    if (user) writeAuthSnapshot(user)
    else clearAuthSnapshot()
    set((prev) => ({
      user,
      csrfToken: csrfToken !== undefined ? csrfToken : prev.csrfToken,
      roles: roles ?? prev.roles,
      enabledProviders: enabledProviders ?? prev.enabledProviders,
      // An explicit false still turns the channel off.
      guestSmsEnabled: guestSmsEnabled ?? prev.guestSmsEnabled,
      status: user ? "authenticated" : "anonymous",
      optimistic: false,
    }))
  },

  // A status transition means a fetch is in flight or has resolved; the optimistic guess no longer holds.
  setStatus: (status) => set({ status, optimistic: false }),

  setAnonymous: () => set({ status: "anonymous", user: null, optimistic: false }),

  clear: () => {
    clearAuthSnapshot()
    set({ status: "anonymous", user: null, csrfToken: null, roles: [], optimistic: false })
  },
}))

/**
 * Signed out for certain: no viewer, and no auth snapshot left. A sign-out, a 401 and a live "not signed
 * in" answer all drop the snapshot; a session check that got no answer (setAnonymous) keeps it, because
 * the cookie may still be valid.
 */
export function isConfirmedSignedOut(state: AuthState): boolean {
  return state.user === null && readAuthSnapshot() === null
}

export function getCsrfToken(): string | undefined {
  return useAuthStore.getState().csrfToken ?? undefined
}

/** Long enough for a slow first GET /auth/session, short enough that a hung backend cannot wedge a tap. */
export const SESSION_SETTLE_TIMEOUT_MS = 8_000

/**
 * During the optimistic window the store is `authenticated` with no CSRF token, so the auth gate and
 * the API client's token getter wait here before letting a mutation proceed.
 *
 * On timeout it resolves with the still-optimistic state rather than rejecting, which callers read as
 * "no live answer". It never mutates the store, so a late hydration still lands normally.
 */
export function waitForSessionSettled(
  timeoutMs: number = SESSION_SETTLE_TIMEOUT_MS,
): Promise<AuthState> {
  const state = useAuthStore.getState()
  if (!state.optimistic) return Promise.resolve(state)
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = useAuthStore.subscribe((next) => {
      if (next.optimistic) return
      if (timer !== null) clearTimeout(timer)
      unsubscribe()
      resolve(next)
    })
    timer = setTimeout(() => {
      unsubscribe()
      resolve(useAuthStore.getState())
    }, timeoutMs)
  })
}

export const selectIsAuthenticated = (s: AuthState): boolean => s.status === "authenticated"
export const selectAuthResolved = (s: AuthState): boolean =>
  s.status === "authenticated" || s.status === "anonymous"
export const selectAuthPending = (s: AuthState): boolean => !selectAuthResolved(s)
