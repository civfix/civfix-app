"use client"

import { create } from "zustand"
import type { UserDTO, OAuthProvider } from "@civfix/shared"

import { readAuthSnapshot, writeAuthSnapshot, clearAuthSnapshot } from "@/lib/auth-snapshot"

/**
 * Authentication state for the web app.
 *
 * Web uses cookie sessions: the session cookie is httpOnly and set by the API, so we never see the
 * token here. What we DO track is the CSRF token (returned by GET /auth/session and the sign-in
 * responses) which must be echoed on mutating requests via the x-csrf-token header.
 *
 * The API client (src/lib/api.ts) reads the current csrfToken through getCsrfToken() at call time,
 * so there is no static import cycle between the store and the client.
 *
 * Optimistic boot: a cosmetic snapshot of the signed-in profile is cached in localStorage (see
 * lib/auth-snapshot). On boot, if a snapshot exists we initialize to `authenticated` with
 * `optimistic:true` so the header paints the avatar on the first frame, then AuthHydrator revalidates
 * GET /auth/session in the background and reconciles. `optimistic` records "this authed state is a
 * guess, not yet server-confirmed"; it is orthogonal to authenticated-vs-anonymous, so it is a flag
 * rather than an AuthStatus value (every existing `status === "authenticated"` consumer keeps working).
 */

export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous"

export interface AuthState {
  status: AuthStatus
  user: UserDTO | null
  csrfToken: string | null
  /** Roles from the session check (a user may hold more than one). Never sourced from the snapshot. */
  roles: string[]
  /**
   * True while the current authenticated state was restored from the localStorage snapshot and has not
   * yet been confirmed by a live GET /auth/session. Cleared on the next setSession/setStatus/clear.
   */
  optimistic: boolean
  /**
   * Sign-in providers the server has configured (from GET /auth/session). Drives which OAuth buttons the
   * auth modal renders. Empty until the first session check resolves; preserved across logout (it is
   * server config, not user state).
   */
  enabledProviders: OAuthProvider[]
  /**
   * Whether the server offers the SMS channel for guest RSVPs (carried by both session responses).
   * Server config rather than user state, so - like enabledProviders - it survives sign-out and is
   * preserved when a later response omits it. Undefined until a live session answer arrives, which the
   * shared GuestRsvpSheet reads as email-only (the safe default).
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
   * Render the signed-out UI WITHOUT a live session answer (the session check failed on the network).
   * Unlike a bare `setStatus("anonymous")` it also clears `user`, so `status` and `user` can never
   * disagree (an "anonymous" status with a stale profile still readable through useCurrentUser is an
   * invariant no consumer expects). Unlike `clear()` it keeps the CSRF token and the cosmetic snapshot,
   * so the next load can still paint optimistically and re-try the session check.
   */
  setAnonymous: () => void
  clear: () => void
}

/**
 * Pure initial-state derivation from a boot-time snapshot read. Extracted so the optimistic-init logic
 * is unit-testable without store-module-reset gymnastics. A snapshot present => optimistically
 * authenticated; absent => idle (kept distinct from `loading` so nothing becomes dead state - the
 * pending predicate covers both).
 */
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
    // Keep the cosmetic snapshot in lockstep with the displayed user: this single write covers every
    // authed-write path (hydrator, refresh, profile/settings updates, auth modal) and the
    // anonymous/expired path. The snapshot is the user's own non-secret profile - never the token.
    if (user) writeAuthSnapshot(user)
    else clearAuthSnapshot()
    set((prev) => ({
      user,
      // Preserve an existing CSRF token if a refresh did not return a new one.
      csrfToken: csrfToken !== undefined ? csrfToken : prev.csrfToken,
      roles: roles ?? prev.roles,
      // Preserve known providers if a refresh omits them (the field is optional on the wire).
      enabledProviders: enabledProviders ?? prev.enabledProviders,
      // Same preserve-on-omit rule as enabledProviders; an explicit false still turns the channel off.
      guestSmsEnabled: guestSmsEnabled ?? prev.guestSmsEnabled,
      status: user ? "authenticated" : "anonymous",
      // A live session result (or sign-out) supersedes any optimistic guess.
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

/**
 * Non-hook accessor for the current CSRF token. Used by the API client (which lives outside React)
 * to inject the x-csrf-token header on mutations without subscribing to the store.
 */
export function getCsrfToken(): string | undefined {
  return useAuthStore.getState().csrfToken ?? undefined
}

/**
 * Ceiling for waiting on the boot-time session hydration (waitForSessionSettled). Generous enough to
 * ride out a slow first GET /auth/session, short enough that a hung backend cannot wedge a tapped
 * action indefinitely - on expiry callers treat the session as signed-out (gate) or proceed tokenless
 * into the normal error path (API client) instead of waiting forever.
 */
export const SESSION_SETTLE_TIMEOUT_MS = 8_000

/**
 * Resolves once the optimistic boot guess has been settled by a live answer (AuthHydrator's
 * GET /auth/session confirming the session, reverse-flipping to anonymous, or the network-failure
 * fallback) - i.e. once `optimistic` is false. Resolves immediately when the state is not optimistic
 * (confirmed, anonymous, or a cold boot with no snapshot).
 *
 * On timeout it resolves with the CURRENT (still-optimistic) state rather than rejecting: callers
 * branch on the resolved state, and "still optimistic after the ceiling" reads as "no live session
 * answer" - the same shape as anonymous for decision purposes. It never mutates the store, so a late
 * hydration can still land normally for the rest of the UI.
 *
 * This is the seam the CSRF boot-race fix hangs on: during the optimistic window the store is
 * `authenticated` with `csrfToken: null`, so a mutation fired immediately would go out without its
 * x-csrf-token header and die on a 403. Both the auth gate (use-auth-gate) and the API client's token
 * getter (lib/api resolveCsrfToken) wait on this before letting a mutation proceed.
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

/** Convenience selectors. */
export const selectIsAuthenticated = (s: AuthState): boolean => s.status === "authenticated"
/** The session check has reached a terminal answer (authed or anon) - no longer guessing or in flight. */
export const selectAuthResolved = (s: AuthState): boolean =>
  s.status === "authenticated" || s.status === "anonymous"
/** Still resolving the session (idle before the check, or the check in flight). Drives neutral skeletons. */
export const selectAuthPending = (s: AuthState): boolean => !selectAuthResolved(s)
