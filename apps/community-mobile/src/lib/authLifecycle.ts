import type { AppLifecycleState, AuthStatus } from "@/lib/lifecycleTypes"

export function isFocused(state: AppLifecycleState | null | undefined): boolean {
  return state !== "background"
}

export function shouldRevalidateOnState(state: AppLifecycleState | null | undefined): boolean {
  return state === "active"
}

export function isSignOutTransition(
  previous: AuthStatus,
  next: AuthStatus,
): boolean {
  return previous === "authed" && next === "unauthed"
}

export function isForeignIdentity(previous: string | null, incoming: string): boolean {
  return previous !== null && previous !== incoming
}
