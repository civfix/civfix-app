export const BOOT_NOTICE_MS = 4000

export const BOOT_DEADLINE_MS = 8000

export const BOOT_GATE_TICK_MS = 500

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
