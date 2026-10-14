/**
 * A pending auth state shows the profile avatar, so a signed-in viewer reloading never flashes the sign-in
 * icon before their session confirms.
 */
import type { AuthState } from "../data"

export type HeaderAuthAffordance = "profile" | "sign-in"

export function headerAuthAffordance(auth: Pick<AuthState, "isAuthenticated" | "isPending">): HeaderAuthAffordance {
  return !auth.isAuthenticated && !auth.isPending ? "sign-in" : "profile"
}
