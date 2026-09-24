import { useEffect, useRef } from "react"
import { AppState } from "react-native"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import {
  freshPushAttemptState,
  isForegroundEdge,
  isPushOutcomeTerminal,
  shouldAttemptPushRegistration,
  type PushAttemptState,
} from "@/lib/pushRegistrationRetry"
import { registerForPushNotifications } from "@/push/register"

export function usePushOnSignIn() {
  const status = useAuthStore((s) => s.status)
  const attemptRef = useRef<PushAttemptState>(freshPushAttemptState())

  useEffect(() => {
    if (status !== "authed") {
      if (status === "unauthed") attemptRef.current = freshPushAttemptState()
      return
    }

    const attempt = (): void => {
      const state = attemptRef.current
      if (!shouldAttemptPushRegistration(state)) return
      state.attempts += 1
      state.inFlight = true

      void (async () => {
        try {
          const prefs = await api.getNotificationPrefs()
          if (!prefs.push) {
            state.settled = true
            return
          }
          const result = await registerForPushNotifications()
          if (isPushOutcomeTerminal(result.status)) {
            state.settled = true
            return
          }
          console.warn(
            `[push] registration not completed: ${result.status}`,
            "reason" in result ? result.reason : "",
          )
        } catch (err) {
          console.warn("[push] notification prefs unreachable; retrying on next foreground", err)
        } finally {
          state.inFlight = false
        }
      })()
    }

    attempt()
    const subscription = AppState.addEventListener("change", (next) => {
      if (isForegroundEdge(attemptRef.current, next)) attempt()
    })
    return () => subscription.remove()
  }, [status])
}
