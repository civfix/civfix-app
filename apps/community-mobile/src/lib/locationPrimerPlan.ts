import type { AuthStatus } from "@/lib/lifecycleTypes"

export type LocationPermission = "undetermined" | "granted" | "denied"

export type LocationPrimerDecision = "wait" | "prompt" | "resolve" | "ip-only"

export interface LocationPrimerInput {
  permission: LocationPermission
  permissionResolved: boolean
  primerShown: boolean
  gateActive: boolean
  authStatus: AuthStatus
  onboardingDone: boolean
  tourPresenting: boolean
  profileIncomplete: boolean
  routeFocused: boolean
}

export function locationPrimerDecision({
  permission,
  permissionResolved,
  primerShown,
  gateActive,
  authStatus,
  onboardingDone,
  tourPresenting,
  profileIncomplete,
  routeFocused,
}: LocationPrimerInput): LocationPrimerDecision {
  if (gateActive) return "wait"
  if (authStatus !== "authed" && authStatus !== "unauthed") return "wait"
  if (!permissionResolved) return "wait"
  if (permission === "granted") return "resolve"
  if (permission === "denied") return "ip-only"
  if (!onboardingDone) return "wait"
  if (tourPresenting) return "wait"
  if (profileIncomplete) return "wait"
  if (!routeFocused) return "wait"
  return primerShown ? "ip-only" : "prompt"
}
