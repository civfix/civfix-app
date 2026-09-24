"use client"

import type { QueryClient } from "@tanstack/react-query"
import { adoptViewer, discardViewerDrafts } from "@civfix/ui"

import { forgetUnsyncedLocale } from "@/lib/locale"
import { clearPersistedCache } from "@/lib/query-persist"
import { adoptUnownedClaimHandoff, clearClaimHandoffOwnedBy } from "@/store/claim-handoff"
import { isConfirmedSignedOut, useAuthStore, type AuthState } from "@/store/auth-store"
import { useSignOutRetryStore } from "@/store/sign-out-retry-store"

function viewerIdOf(state: AuthState): string | null {
  return state.user?.id ?? null
}

/**
 * Shared-device safety: what this browser holds for a signed-in viewer (the persisted and in-memory
 * query caches, the anonymous-report claim handoff they saved, a locale change still waiting to reach
 * their account, every draft in @civfix/ui) is dropped the moment that viewer is confirmed gone:
 * sign-out, a 401 that ended the session, a live "not signed in" answer, or a different account
 * signing in. A guest signing in keeps the claim handoff, because claiming
 * their own anonymous report is exactly what that handoff is for; the handoff then belongs to the account a
 * live session answer confirms, so that account's departure purges it.
 */
export function installViewerScope(queryClient: QueryClient): () => void {
  const initial = useAuthStore.getState()
  let confirmedViewerId = viewerIdOf(initial)
  adoptViewer(confirmedViewerId)
  adoptUnownedClaimHandoff(initial)
  return useAuthStore.subscribe((state) => {
    const viewerId = viewerIdOf(state)
    adoptViewer(viewerId)
    adoptUnownedClaimHandoff(state)
    if (viewerId === confirmedViewerId) return
    if (viewerId === null && !isConfirmedSignedOut(state)) return
    const departedViewerId = confirmedViewerId
    confirmedViewerId = viewerId
    if (viewerId === null) useSignOutRetryStore.getState().dismiss()
    if (departedViewerId === null) return
    clearPersistedCache()
    queryClient.clear()
    clearClaimHandoffOwnedBy(departedViewerId)
    forgetUnsyncedLocale()
    if (viewerId === null) discardViewerDrafts()
  })
}
