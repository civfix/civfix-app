"use client"

import type { QueryClient } from "@tanstack/react-query"
import { adoptPostComposerViewer, discardPostComposerDraft } from "@civfix/ui"

import { readAuthSnapshot } from "@/lib/auth-snapshot"
import { clearPersistedCache } from "@/lib/query-persist"
import { clearClaimHandoff } from "@/store/claim-handoff"
import { useAuthStore, type AuthState } from "@/store/auth-store"

function viewerIdOf(state: AuthState): string | null {
  return state.user?.id ?? null
}

/**
 * A viewer is confirmed gone only by a sign-out, a 401 or a live "not signed in" answer, and each of those
 * drops the auth snapshot. A session check that got no answer (setAnonymous) keeps it: the cookie may
 * well still be valid, so that viewer's state must survive until the next answer.
 */
function viewerConfirmedGone(): boolean {
  return readAuthSnapshot() === null
}

/**
 * Shared-device safety: what this browser holds for a signed-in viewer (the persisted and in-memory
 * query caches, the anonymous-report claim handoff, the post-composer draft) is dropped the moment that
 * viewer is confirmed gone: sign-out, a 401 that ended the session, a live "not signed in" answer, or a
 * different account signing in. A guest signing in keeps the claim handoff, because claiming their own
 * anonymous report is exactly what that handoff is for.
 */
export function installViewerScope(queryClient: QueryClient): () => void {
  let confirmedViewerId = viewerIdOf(useAuthStore.getState())
  adoptPostComposerViewer(confirmedViewerId)
  return useAuthStore.subscribe((state) => {
    const viewerId = viewerIdOf(state)
    adoptPostComposerViewer(viewerId)
    if (viewerId === confirmedViewerId) return
    if (viewerId === null && !viewerConfirmedGone()) return
    const departedViewerId = confirmedViewerId
    confirmedViewerId = viewerId
    if (departedViewerId === null) return
    clearPersistedCache()
    queryClient.clear()
    clearClaimHandoff()
    if (viewerId === null) discardPostComposerDraft()
  })
}
