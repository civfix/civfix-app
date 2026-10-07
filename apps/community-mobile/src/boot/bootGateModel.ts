export const BOOT_NOTICE_MS = 4000

export const BOOT_DEADLINE_MS = 8000

/**
 * Every elapsed time `bootGateState` compares against. Its output is constant between two of these,
 * so the hooks wake at each one instead of ticking.
 */
export const BOOT_GATE_THRESHOLDS_MS: readonly number[] = [BOOT_NOTICE_MS, BOOT_DEADLINE_MS]

export const BOOT_PHASE_THRESHOLDS_MS: readonly number[] = [BOOT_DEADLINE_MS]

/** The largest threshold `elapsedMs` has reached, or 0: an elapsed time the gate reads identically. */
export function reachedThreshold(elapsedMs: number, thresholds: readonly number[]): number {
  let reached = 0
  for (const at of thresholds) if (elapsedMs >= at && at > reached) reached = at
  return reached
}

export type BootNetworkOutcome = "pending" | "ok" | "timeout" | "error"

export type BootPhase = "connecting" | "ready" | "offline" | "signin"

export interface BootGateInput {
  sessionPresent: boolean | null
  cachedUser: boolean
  networkOutcome: BootNetworkOutcome
  elapsedMs: number
}

export interface BootGateState {
  phase: BootPhase
  showNotice: boolean
  showRetry: boolean
}

const UNREACHABLE: BootGateState = { phase: "offline", showNotice: true, showRetry: true }

function settled(phase: BootPhase): BootGateState {
  return { phase, showNotice: false, showRetry: false }
}

function waiting(elapsedMs: number): BootGateState {
  return {
    phase: "connecting",
    showNotice: elapsedMs >= BOOT_NOTICE_MS,
    showRetry: elapsedMs >= BOOT_DEADLINE_MS,
  }
}

export function bootGateState({
  sessionPresent,
  cachedUser,
  networkOutcome,
  elapsedMs,
}: BootGateInput): BootGateState {
  if (sessionPresent === null) {
    if (elapsedMs < BOOT_DEADLINE_MS) return waiting(elapsedMs)
    return { ...UNREACHABLE, phase: "signin" }
  }

  if (networkOutcome === "timeout" || networkOutcome === "error") {
    if (cachedUser) return { ...UNREACHABLE, phase: "ready" }
    if (sessionPresent) return UNREACHABLE
    return { ...UNREACHABLE, phase: "signin" }
  }

  if (networkOutcome === "ok") return settled(sessionPresent || cachedUser ? "ready" : "signin")

  if (cachedUser) return settled("ready")
  if (!sessionPresent) return settled("signin")
  return waiting(elapsedMs)
}
