"use client"

import { create } from "zustand"

/**
 * A sign-out whose POST /auth/logout failed (offline, a 5xx). Local state is already purged, but the
 * httpOnly session cookie stays valid until a logout succeeds, so a reload would sign the previous user
 * back in. `failures` counts the attempts the user must be told about; `csrfToken` is the token of the
 * session being ended, kept (in memory only) because the auth store has already dropped it.
 */
interface SignOutRetryState {
  failures: number
  csrfToken: string | null
  fail: (csrfToken: string | null) => void
  settle: () => void
}

export const useSignOutRetryStore = create<SignOutRetryState>((set) => ({
  failures: 0,
  csrfToken: null,
  fail: (csrfToken) => set((state) => ({ failures: state.failures + 1, csrfToken })),
  settle: () => set({ csrfToken: null }),
}))
