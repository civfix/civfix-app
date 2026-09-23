import type { OrganizationInviteDTO } from "@civfix/shared"

import { notifyConsoleUrlChanged } from "@/components/console/url-state"

/** The backend's `ORG_INVITE_TTL_MS` (14 days) - the copy says it before an invite exists. */
export const ORG_INVITE_TTL_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days until `iso`, rounded up so "expires in 1 day" reads until the moment it expires and
 * never says "0 days" for a still-valid invite. Zero or negative means it has already expired.
 */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return 0
  return Math.ceil((at - now) / DAY_MS)
}

/**
 * The server lists what is still actionable (pending, plus expired rows it has not swept yet); an
 * accepted or revoked invite that does slip through is history, not a pending invite.
 */
export function visibleInvites(items: readonly OrganizationInviteDTO[]): OrganizationInviteDTO[] {
  return items.filter((invite) => invite.status === "pending" || invite.status === "expired")
}

/**
 * A pending invite is "expired" when the server says so OR when its `expiresAt` has passed and
 * the server has not swept it yet - the accept would fail with CONFLICT either way.
 */
export function inviteIsExpired(invite: OrganizationInviteDTO, now: number = Date.now()): boolean {
  return invite.status === "expired" || daysUntil(invite.expiresAt, now) <= 0
}

/**
 * The accept page's token survives a sign-in round trip here. Email OTP signs in on the spot (the
 * console keeps its URL, so the token is still in the query), but the OAuth providers redirect back
 * to the site root and drop it; a signed-out visit stashes the token, and the accept page re-reads
 * it when its URL has none. sessionStorage, not localStorage: it is a capability token (DECISIONS
 * §30), so it should not outlive the tab.
 */
export const ORG_INVITE_TOKEN_STASH_KEY = "civfix-console:org-invite-token"

export function stashInviteToken(token: string): void {
  try {
    window.sessionStorage.setItem(ORG_INVITE_TOKEN_STASH_KEY, token)
  } catch {
    // Storage can be unavailable (private mode, blocked); the URL still carries the token.
  }
}

export function readStashedInviteToken(): string | null {
  try {
    const value = window.sessionStorage.getItem(ORG_INVITE_TOKEN_STASH_KEY)
    return value === null || value.trim() === "" ? null : value
  } catch {
    return null
  }
}

export function clearStashedInviteToken(): void {
  try {
    window.sessionStorage.removeItem(ORG_INVITE_TOKEN_STASH_KEY)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Once the console has read the token it leaves the URL: the address bar, the history entry and
 * anything that copies the URL (share sheet, bookmarks, "copy link") no longer carry a capability
 * token, and Back onto the accept page finds no token to spend again. `replaceState`, so the entry
 * stays where it is; the console's history bridge is told so the route re-parses.
 */
export function stripInviteTokenFromUrl(): void {
  if (typeof window === "undefined") return
  const { pathname, search, hash } = window.location
  if (search === "" && hash === "") return
  // No state object: Next's patched replaceState skips syncing its router for an entry it marked (__NA),
  // so it would keep the old URL and write it back on its next navigation.
  window.history.replaceState(null, "", pathname)
  notifyConsoleUrlChanged()
}
