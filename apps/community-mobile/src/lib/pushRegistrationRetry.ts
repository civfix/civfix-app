export const PUSH_ATTEMPT_LIMIT = 3

export type PushOutcomeStatus = "registered" | "denied" | "unsupported" | "conflict" | "error"

export interface PushAttemptState {
  attempts: number
  settled: boolean
  inFlight: boolean
  backgrounded: boolean
}

export function freshPushAttemptState(): PushAttemptState {
  return { attempts: 0, settled: false, inFlight: false, backgrounded: false }
}

export function shouldAttemptPushRegistration(state: PushAttemptState): boolean {
  if (state.settled || state.inFlight) return false
  return state.attempts < PUSH_ATTEMPT_LIMIT
}

export function isPushOutcomeTerminal(status: PushOutcomeStatus): boolean {
  return (
    status === "registered" ||
    status === "denied" ||
    status === "unsupported" ||
    status === "conflict"
  )
}

export function isForegroundEdge(state: PushAttemptState, next: string): boolean {
  if (next === "background") {
    state.backgrounded = true
    return false
  }
  if (next !== "active" || !state.backgrounded) return false
  state.backgrounded = false
  return true
}
