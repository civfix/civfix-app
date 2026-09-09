export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

export type AuthLifecycleStatus = "idle" | "loading" | "authed" | "unauthed"

export function isFocused(state: AppLifecycleState | null | undefined): boolean {
  return state !== "background"
}

export function shouldRevalidateOnState(state: AppLifecycleState | null | undefined): boolean {
  return state === "active"
}

export function isSignOutTransition(
  previous: AuthLifecycleStatus,
  next: AuthLifecycleStatus,
): boolean {
  return previous === "authed" && next === "unauthed"
}

export function isForeignIdentity(previous: string | null, incoming: string): boolean {
  return previous !== null && previous !== incoming
}
