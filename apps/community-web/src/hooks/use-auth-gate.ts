"use client"

import * as React from "react"

import {
  useAuthStore,
  waitForSessionSettled,
  SESSION_SETTLE_TIMEOUT_MS,
  type AuthState,
} from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

/** Never the optimistic guess, which has no CSRF token yet. */
function isConfirmedAuthed(state: AuthState): boolean {
  return state.status === "authenticated" && !state.optimistic
}

// Callers pass a fresh closure per tap, so there is no key to dedupe by. While one tap is parked,
// further taps are dropped: replaying both after the settle would fire a toggle twice (like, then
// unlike) or send a duplicate RSVP, and the window only lasts as long as the session check.
let deferredTapPending = false

/** Reads the auth store at call time, so a tap decides on the state when it happens, not at render. */
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
    // Probably signed in, but the CSRF token has not arrived, and a tokenless mutation would die on a
    // silent 403. Re-decide once the session check settles; a timeout leaves the state optimistic,
    // which isConfirmedAuthed rejects, so the viewer gets the modal.
    if (deferredTapPending) return
    deferredTapPending = true
    void waitForSessionSettled(timeoutMs).then((settled) => {
      deferredTapPending = false
      if (isConfirmedAuthed(settled)) action()
      else openAuthModal()
    })
    return
  }
  openAuthModal()
}

/**
 * Runs the action for a confirmed session and opens the auth modal otherwise. During the optimistic
 * boot window the tap defers until the session check settles (bounded by SESSION_SETTLE_TIMEOUT_MS).
 */
export function useAuthGate(): (action: () => void) => void {
  const openAuthModal = useUiStore((s) => s.openAuthModal)

  return React.useCallback(
    (action: () => void) => runGatedAction(action, openAuthModal),
    [openAuthModal],
  )
}
