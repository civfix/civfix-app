"use client"

import { create } from "zustand"

/**
 * A sign-out whose POST /auth/logout failed (offline, a 5xx). The httpOnly session cookie is still
 * valid then, so the app keeps the user signed in and shows a persistent notice with a retry instead of
 * pretending the sign-out happened. useLogout runs above the i18n provider, so the notice reads its
 * state from here.
 */
interface SignOutRetryState {
  pending: boolean
  failed: boolean
  begin: () => boolean
  finish: (revoked: boolean) => void
  dismiss: () => void
}

export const useSignOutRetryStore = create<SignOutRetryState>((set, get) => ({
  pending: false,
  failed: false,
  begin: () => {
    if (get().pending) return false
    set({ pending: true })
    return true
  },
  finish: (revoked) => set({ pending: false, failed: !revoked }),
  dismiss: () => set({ failed: false }),
}))
