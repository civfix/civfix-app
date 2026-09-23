"use client"

/**
 * Claim handoff: the result of a successful anonymous submit (reportId + claimCode) is written to
 * localStorage so the /claim flow can pick it up even after the tab is closed. The in-progress report
 * draft itself lives in the shared report wizard (@civfix/ui), which owns that state now; only this
 * handle - which must outlive the wizard's session - is web-app-local.
 */

import { useAuthStore } from "@/store/auth-store"

export interface ClaimHandoff {
  /** Null when the code arrived in a link that did not name its report. */
  reportId: string | null
  claimCode: string
}

interface StoredClaimHandoff extends ClaimHandoff {
  /**
   * The confirmed viewer it was saved under, or null for a guest or a not-yet-confirmed session. Only
   * that viewer's departure may purge it: a code saved during an optimistic boot must survive the
   * snapshot turning out expired, since it is what the sign-in round trip comes back to claim.
   */
  ownerId: string | null
}

const CLAIM_HANDOFF_KEY = "civfix.claim-handoff"

function confirmedViewerId(): string | null {
  const state = useAuthStore.getState()
  return state.status === "authenticated" && !state.optimistic ? (state.user?.id ?? null) : null
}

/** Persist the most recent submit's claim handle. No-op on the server / when storage is unavailable. */
export function saveClaimHandoff(handoff: ClaimHandoff): void {
  if (typeof window === "undefined") return
  const stored: StoredClaimHandoff = { ...handoff, ownerId: confirmedViewerId() }
  try {
    window.localStorage.setItem(CLAIM_HANDOFF_KEY, JSON.stringify(stored))
  } catch {
    // Storage may be full or blocked (private mode); the claim flow still works via the URL param.
  }
}

/** Read the saved claim handle, or null if none/unparseable. */
export function readClaimHandoff(): ClaimHandoff | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CLAIM_HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClaimHandoff>
    if (
      (typeof parsed.reportId === "string" || parsed.reportId === null) &&
      typeof parsed.claimCode === "string"
    ) {
      return { reportId: parsed.reportId, claimCode: parsed.claimCode }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Purge the saved claim handle if it belongs to a viewer who is now gone. One saved before owners were
 * recorded has no owner field and is purged too.
 */
export function clearClaimHandoffOwnedBy(viewerId: string): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(CLAIM_HANDOFF_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<StoredClaimHandoff>
    if (parsed.ownerId === null) return
    if (typeof parsed.ownerId === "string" && parsed.ownerId !== viewerId) return
  } catch {
    // Unreadable: drop it rather than leave an unowned copy behind.
  }
  clearClaimHandoff()
}

/** Clear the saved claim handle (after a successful claim). */
export function clearClaimHandoff(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(CLAIM_HANDOFF_KEY)
  } catch {
    // ignore
  }
}
