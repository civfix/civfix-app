"use client"

import type { QueryClient } from "@tanstack/react-query"
import { adoptPostComposerViewer } from "@civfix/ui"

import { clearPersistedCache } from "@/lib/query-persist"
import { clearClaimHandoff } from "@/store/claim-handoff"
import { useAuthStore, type AuthState } from "@/store/auth-store"

function viewerIdOf(state: AuthState): string | null {
  return state.user?.id ?? null
}

/**
 * Shared-device safety: what this browser holds for a signed-in viewer (the persisted and in-memory
 * query caches, the anonymous-report claim handoff, the post-composer draft) is dropped the moment that
 * viewer is gone, whichever path moved the auth store: sign-out, a 401 that ended the session, or a
 * different account signing in. A guest signing in keeps the claim handoff, because claiming their own
 * anonymous report is exactly what that handoff is for.
 */
export function installViewerScope(queryClient: QueryClient): () => void {
  adoptPostComposerViewer(viewerIdOf(useAuthStore.getState()))
  return useAuthStore.subscribe((state, previous) => {
    const viewerId = viewerIdOf(state)
    const previousViewerId = viewerIdOf(previous)
    adoptPostComposerViewer(viewerId)
    if (previousViewerId === null || previousViewerId === viewerId) return
    clearPersistedCache()
    queryClient.clear()
    clearClaimHandoff()
  })
}
