"use client"

/** Kept in localStorage so the /claim flow can pick the handle up even after the tab is closed. */

import { safeGet, safeRemove, safeSet } from "@/lib/browser-storage"
import { useAuthStore, type AuthState } from "@/store/auth-store"

export interface ClaimHandoff {
  /** Null when the code arrived in a link that did not name its report. */
  reportId: string | null
  claimCode: string
}

interface StoredClaimHandoff extends ClaimHandoff {
  /**
   * The confirmed viewer it belongs to: the one it was saved under, or else the first viewer a live
   * session answer confirms afterwards (adoptUnownedClaimHandoff). Null only until then, for a guest or a
   * not-yet-confirmed session. Only the owner's departure may purge it: a code saved during an optimistic
   * boot must survive the snapshot turning out expired, since it is what the sign-in round trip comes back
   * to claim, yet must not outlive the account that confirmed on this device.
   */
  ownerId: string | null
}

const CLAIM_HANDOFF_KEY = "civfix.claim-handoff"

function confirmedViewerIdOf(state: AuthState): string | null {
  return state.status === "authenticated" && !state.optimistic ? (state.user?.id ?? null) : null
}

function confirmedViewerId(): string | null {
  return confirmedViewerIdOf(useAuthStore.getState())
}

export function saveClaimHandoff(handoff: ClaimHandoff): void {
  const stored: StoredClaimHandoff = { ...handoff, ownerId: confirmedViewerId() }
  safeSet("local", CLAIM_HANDOFF_KEY, JSON.stringify(stored))
}

function readStored(): Partial<StoredClaimHandoff> | null {
  const raw = safeGet("local", CLAIM_HANDOFF_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<StoredClaimHandoff>
  } catch {
    return null
  }
}

export function readClaimHandoff(): ClaimHandoff | null {
  const parsed = readStored()
  if (
    parsed !== null &&
    (typeof parsed.reportId === "string" || parsed.reportId === null) &&
    typeof parsed.claimCode === "string"
  ) {
    return { reportId: parsed.reportId, claimCode: parsed.claimCode }
  }
  return null
}

/** Give an unowned saved claim handle to the viewer `state` confirms; a no-op until one is confirmed. */
export function adoptUnownedClaimHandoff(state: AuthState): void {
  const ownerId = confirmedViewerIdOf(state)
  if (ownerId === null) return
  if (readStored()?.ownerId !== null) return
  const handoff = readClaimHandoff()
  if (!handoff) return
  const stored: StoredClaimHandoff = { ...handoff, ownerId }
  safeSet("local", CLAIM_HANDOFF_KEY, JSON.stringify(stored))
}

/**
 * Purge the saved claim handle if it belongs to a viewer who is now gone. One saved before owners were
 * recorded has no owner field and is purged too.
 */
export function clearClaimHandoffOwnedBy(viewerId: string): void {
  const raw = safeGet("local", CLAIM_HANDOFF_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as Partial<StoredClaimHandoff>
    if (parsed.ownerId === null) return
    if (typeof parsed.ownerId === "string" && parsed.ownerId !== viewerId) return
  } catch {
    // Unreadable: drop it rather than leave an unowned copy behind.
  }
  clearClaimHandoff()
}

export function clearClaimHandoff(): void {
  safeRemove("local", CLAIM_HANDOFF_KEY)
}
