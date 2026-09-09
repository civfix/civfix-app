"use client"

/**
 * Claim handoff: the result of a successful anonymous submit (reportId + claimCode) is written to
 * localStorage so the /claim flow can pick it up even after the tab is closed. The in-progress report
 * draft itself lives in the shared report wizard (@civfix/ui), which owns that state now; only this
 * handle - which must outlive the wizard's session - is web-app-local.
 */

export interface ClaimHandoff {
  reportId: string
  claimCode: string
}

const CLAIM_HANDOFF_KEY = "civfix.claim-handoff"

/** Persist the most recent submit's claim handle. No-op on the server / when storage is unavailable. */
export function saveClaimHandoff(handoff: ClaimHandoff): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CLAIM_HANDOFF_KEY, JSON.stringify(handoff))
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
    if (typeof parsed.reportId === "string" && typeof parsed.claimCode === "string") {
      return { reportId: parsed.reportId, claimCode: parsed.claimCode }
    }
    return null
  } catch {
    return null
  }
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
