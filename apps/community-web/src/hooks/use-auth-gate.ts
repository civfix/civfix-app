"use client"

import * as React from "react"

import {
  useAuthStore,
  waitForSessionSettled,
  SESSION_SETTLE_TIMEOUT_MS,
  type AuthState,
} from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

/**
 * Auth-gate guard for interactive actions.
 *
 * Returns `runAuthed(action)`: when the viewer is authenticated it runs `action()`; otherwise it
 * opens the auth modal instead (the single openAuthModal source from the UI store). This collapses the
 * `if (!isAuthenticated) { openAuthModal(); return }` guard that was hand-written before every
 * RSVP / message / follow / "see it too" action.
 *
 * Boot race: during the optimistic boot window the store reads `authenticated` from the localStorage
 * snapshot while `csrfToken` is still null (GET /auth/session has not landed). An action run
 * immediately in that window would issue its mutation WITHOUT the x-csrf-token header and die on a
 * silent 403. So an optimistic-authenticated tap DEFERS: it waits for the session check to settle
 * (bounded by SESSION_SETTLE_TIMEOUT_MS) and then either runs the action (session confirmed, real
 * token in the store) or opens the auth modal (session expired, or no live answer inside the ceiling -
 * firing tokenless would only manufacture the silent 403 this exists to prevent).
 *
 * Card-nested buttons that also need `e.stopPropagation()/preventDefault()` keep that locally (it is
 * about the surrounding clickable card, not auth) and call runAuthed for the auth decision.
 */

/** The settled state permits the action: a live-confirmed session (never the optimistic guess). */
function isConfirmedAuthed(state: AuthState): boolean {
  return state.status === "authenticated" && !state.optimistic
}

/**
 * Non-hook core of the gate, reading the auth store at CALL time (a tap decides on the state of the
 * world when it happens, not when the component rendered). Extracted so the deferral logic is
 * unit-testable without rendering the hook.
 */
export function runGatedAction(
  action: () => void,
  openAuthModal: () => void,
  timeoutMs: number = SESSION_SETTLE_TIMEOUT_MS,
): void {
  const state = useAuthStore.getState()
  if (isConfirmedAuthed(state)) {
    action()
    return
  }
  if (state.status === "authenticated" && state.optimistic) {
    // Optimistic window: probably signed in, but the CSRF token has not arrived yet. Defer until the
    // session check settles, then re-decide on the settled state. A timeout resolves with the state
    // still optimistic, which isConfirmedAuthed rejects - the modal, not a tokenless 403.
    void waitForSessionSettled(timeoutMs).then((settled) => {
      if (isConfirmedAuthed(settled)) action()
      else openAuthModal()
    })
    return
  }
  openAuthModal()
}

export function useAuthGate(): (action: () => void) => void {
  const openAuthModal = useUiStore((s) => s.openAuthModal)

  return React.useCallback(
    (action: () => void) => runGatedAction(action, openAuthModal),
    [openAuthModal],
  )
}
