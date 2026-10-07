import { useEffect, useMemo, useState } from "react"
import {
  BOOT_GATE_THRESHOLDS_MS,
  BOOT_PHASE_THRESHOLDS_MS,
  bootGateState,
  reachedThreshold,
  type BootGateState,
  type BootPhase,
} from "@/boot/bootGateModel"
import { useAuthStore } from "@/store/authStore"

function useBootGateFor(thresholds: readonly number[]): BootGateState {
  const sessionPresent = useAuthStore((s) => s.sessionPresent)
  const cachedUser = useAuthStore((s) => s.user != null)
  const networkOutcome = useAuthStore((s) => s.networkOutcome)
  const restoreStartedAt = useAuthStore((s) => s.restoreStartedAt)

  const pending = sessionPresent === null || networkOutcome === "pending"
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!pending) return
    const waited = Date.now() - restoreStartedAt
    setElapsedMs(reachedThreshold(waited, thresholds))
    const timers = thresholds
      .filter((at) => at > waited)
      .map((at) => setTimeout(() => setElapsedMs(at), at - waited))
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [pending, restoreStartedAt, thresholds])

  return useMemo(
    () => bootGateState({ sessionPresent, cachedUser, networkOutcome, elapsedMs }),
    [sessionPresent, cachedUser, networkOutcome, elapsedMs],
  )
}

export function useBootGate(): BootGateState {
  return useBootGateFor(BOOT_GATE_THRESHOLDS_MS)
}

/**
 * The phase alone, for the root layout: it changes only at the deadline, so the provider tree
 * re-renders once there rather than each time the splash's notice appears.
 */
export function useBootPhase(): BootPhase {
  return useBootGateFor(BOOT_PHASE_THRESHOLDS_MS).phase
}

export function retrySessionRestore(): void {
  void useAuthStore.getState().retrySessionRestore()
}
