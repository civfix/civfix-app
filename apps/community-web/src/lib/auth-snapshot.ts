import { UserDTOSchema, type UserDTO } from "@civfix/shared"

/**
 * Optimistic, display-only cache of the signed-in user's profile, persisted in localStorage so the
 * header can paint the signed-in chrome (avatar) on the first frame instead of flashing the actionable
 * "Sign in" pill while GET /auth/session resolves.
 *
 * This is COSMETIC ONLY. The real session is the httpOnly cookie (invisible to JS) and the CSRF token
 * is deliberately never persisted, so a stale snapshot can never grant access: mutations stay blocked
 * until the live session check returns a fresh CSRF token, exactly as on any reload. We store the
 * user's own non-secret UserDTO and nothing else (no roles, no token).
 *
 * Every function is guarded against a missing `window` because the store module that consumes them is
 * evaluated during the Next.js static-export build, where there is no localStorage. The functions never
 * throw - quota, private-mode SecurityError, corrupt JSON, and shape/version drift all degrade to a
 * clean miss.
 */

/** Storage key. Version is in the key so a future shape bump is a clean miss, not a wrong-shape parse. */
export const SNAPSHOT_KEY = "civfix.auth.snapshot.v1"
const SNAPSHOT_VERSION = 1

/** Persisted body. The version literal also lives here to guard a hand-edited or half-migrated value. */
interface SnapshotBody {
  v: typeof SNAPSHOT_VERSION
  user: UserDTO
}

/**
 * Read the cached profile, or null when absent/unreadable. Any failure - no window, missing key, bad
 * JSON, schema or version mismatch, or a SecurityError from a privacy-mode localStorage - clears the
 * key (best effort) and returns null. Never throws.
 */
export function readAuthSnapshot(): UserDTO | null {
  if (typeof window === "undefined") return null

  let raw: string | null
  try {
    raw = window.localStorage.getItem(SNAPSHOT_KEY)
  } catch {
    // SecurityError (storage disabled / partitioned). Nothing to clear; treat as a miss.
    return null
  }
  if (raw === null) return null

  try {
    const body = JSON.parse(raw) as unknown
    if (
      typeof body === "object" &&
      body !== null &&
      (body as { v?: unknown }).v === SNAPSHOT_VERSION
    ) {
      // Validate the cosmetic shape with the single-sourced contract schema rather than redefining it.
      const parsed = UserDTOSchema.safeParse((body as { user?: unknown }).user)
      if (parsed.success) return parsed.data
    }
  } catch {
    // Corrupt JSON: fall through to clear + miss.
  }

  clearAuthSnapshot()
  return null
}

/** Best-effort persist of the signed-in profile. Ignores quota / private-mode write failures. */
export function writeAuthSnapshot(user: UserDTO): void {
  if (typeof window === "undefined") return
  const body: SnapshotBody = { v: SNAPSHOT_VERSION, user }
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(body))
  } catch {
    // Quota exceeded or storage unavailable (private mode): the snapshot is an optimization, not state.
  }
}

/** Best-effort removal of the cached profile. */
export function clearAuthSnapshot(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // Storage unavailable: nothing to do.
  }
}
