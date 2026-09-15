import { useEffect, useMemo, useState } from "react"
import { BOOT_GATE_TICK_MS, bootGateState, type BootGateState } from "@/boot/bootGateModel"
import { useAuthStore } from "@/store/authStore"

export function useBootGate(): BootGateState {
  const sessionPresent = useAuthStore((s) => s.sessionPresent)
  const cachedUser = useAuthStore((s) => s.user != null)
  const networkOutcome = useAuthStore((s) => s.networkOutcome)
  const restoreStartedAt = useAuthStore((s) => s.restoreStartedAt)

  const pending = sessionPresent === null || networkOutcome === "pending"
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!pending) return
    setElapsedMs(Date.now() - restoreStartedAt)
    const tick = setInterval(
      () => setElapsedMs(Date.now() - restoreStartedAt),
      BOOT_GATE_TICK_MS,
    )
    return () => clearInterval(tick)
  }, [pending, restoreStartedAt])

  return useMemo(
    () => bootGateState({ sessionPresent, cachedUser, networkOutcome, elapsedMs }),
    [sessionPresent, cachedUser, networkOutcome, elapsedMs],
  )
}

export function retrySessionRestore(): void {
  void useAuthStore.getState().retrySessionRestore()
}
