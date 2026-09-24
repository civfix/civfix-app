import { useCallback, useEffect, useState } from "react"
import { AppState } from "react-native"
import { resendDeadline, resendSecondsLeft } from "@/lib/otpCooldown"

const COOLDOWN_TICK_MS = 1000

export interface ResendCooldown {
  availableAt: number
  cooldown: number
  restart: (seconds: number) => void
}

export function useResendCooldown(initialSeconds: number): ResendCooldown {
  const [availableAt, setAvailableAt] = useState(() => resendDeadline(Date.now(), initialSeconds))
  const [cooldown, setCooldown] = useState(initialSeconds)

  useEffect(() => {
    const sync = (): number => {
      const left = resendSecondsLeft(availableAt, Date.now())
      setCooldown(left)
      return left
    }
    if (sync() === 0) return

    const tick = setInterval(() => {
      if (sync() === 0) clearInterval(tick)
    }, COOLDOWN_TICK_MS)
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync()
    })

    return () => {
      clearInterval(tick)
      subscription.remove()
    }
  }, [availableAt])

  const restart = useCallback((seconds: number) => {
    setAvailableAt(resendDeadline(Date.now(), seconds))
  }, [])

  return { availableAt, cooldown, restart }
}
