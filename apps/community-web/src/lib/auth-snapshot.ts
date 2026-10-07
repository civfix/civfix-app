import { UserDTOSchema, type UserDTO } from "@civfix/shared"

import { safeGet, safeRemove, safeSet } from "@/lib/browser-storage"

/**
 * A display-only cache so the header paints the signed-in chrome on the first frame instead of flashing
 * "Sign in" while GET /auth/session resolves. It is cosmetic only: the session is the httpOnly cookie and
 * the CSRF token is never persisted, so a stale snapshot cannot grant access. Store the user's own
 * non-secret UserDTO and nothing else (no roles, no token).
 *
 * Every function guards `window` because the consuming store is evaluated during the static-export build,
 * and never throws: quota, private-mode SecurityError, corrupt JSON and version drift are a clean miss.
 */

/** The version is in the key so a future shape bump is a clean miss, not a wrong-shape parse. */
export const SNAPSHOT_KEY = "civfix.auth.snapshot.v1"
const SNAPSHOT_VERSION = 1

/** The version also lives in the body to guard a hand-edited or half-migrated value. */
interface SnapshotBody {
  v: typeof SNAPSHOT_VERSION
  user: UserDTO
}

export function readAuthSnapshot(): UserDTO | null {
  if (typeof window === "undefined") return null

  const raw = safeGet("local", SNAPSHOT_KEY)
  if (raw === null) return null

  try {
    const body = JSON.parse(raw) as unknown
    if (
      typeof body === "object" &&
      body !== null &&
      (body as { v?: unknown }).v === SNAPSHOT_VERSION
    ) {
      const parsed = UserDTOSchema.safeParse((body as { user?: unknown }).user)
      if (parsed.success) return parsed.data
    }
  } catch {
    // Corrupt JSON: fall through to clear + miss.
  }

  clearAuthSnapshot()
  return null
}

export function writeAuthSnapshot(user: UserDTO): void {
  if (typeof window === "undefined") return
  const body: SnapshotBody = { v: SNAPSHOT_VERSION, user }
  safeSet("local", SNAPSHOT_KEY, JSON.stringify(body))
}

export function clearAuthSnapshot(): void {
  if (typeof window === "undefined") return
  safeRemove("local", SNAPSHOT_KEY)
}
