/**
 * Which trailing affordance the portrait/compact SearchHeader shows: the profile avatar, or a sign-in
 * icon. Pure predicate over the shared AuthState so it can be unit-tested and kept as ONE source of truth
 * (both the web and native CompactShell seams derive the header from it).
 *
 *   - signed out (terminal: not authed AND not pending) -> "sign-in": a sign-in icon that opens auth
 *     directly, instead of the old "You" avatar that opened a profile with nothing but a sign-in button.
 *   - otherwise (authed, OR still resolving) -> "profile": the avatar. Treating PENDING as profile keeps a
 *     logged-in viewer who is reloading from briefly seeing the sign-in icon before their session confirms.
 */
import type { AuthState } from "../data"

export type HeaderAuthAffordance = "profile" | "sign-in"

export function headerAuthAffordance(auth: Pick<AuthState, "isAuthenticated" | "isPending">): HeaderAuthAffordance {
  return !auth.isAuthenticated && !auth.isPending ? "sign-in" : "profile"
}
