import { useEffect } from "react"
import { AppState } from "react-native"
import { useLegalUpdatePending } from "@civfix/ui/data"
import * as Notifications from "expo-notifications"
import { useAuthStore } from "@/store/authStore"
import { promptForNativePush, reconcileNativeDelivered, syncNativePushToken } from "@/push/register"

/**
 * While signed in: registers the device token at launch, on every return to the app and whenever the token
 * rotates, and removes delivered notifications read elsewhere. After a sign-in from the sign-in screen it
 * shows the system prompt once per device (D6).
 */
export function usePushOnSignIn() {
  const status = useAuthStore((s) => s.status)
  const legalUpdatePending = useLegalUpdatePending()
  const promptPending = useAuthStore((s) => s.pushPromptPending)

  useEffect(() => {
    if (status !== "authed") return
    void syncNativePushToken()
    void reconcileNativeDelivered()

    // iOS passes through "inactive" for a system prompt or Control Center without leaving the app; only a
    // return from "background" counts as coming back.
    let backgrounded = false
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgrounded = true
        return
      }
      if (next !== "active" || !backgrounded) return
      backgrounded = false
      void syncNativePushToken()
      void reconcileNativeDelivered()
    })
    const rotation = Notifications.addPushTokenListener((token) => {
      void syncNativePushToken(token)
    })
    return () => {
      appState.remove()
      rotation.remove()
    }
  }, [status])

  useEffect(() => {
    // The system's notifications dialog would open over the legal update screen; it asks once that closes.
    if (status !== "authed" || !promptPending || legalUpdatePending) return
    useAuthStore.setState({ pushPromptPending: false })
    void promptForNativePush()
  }, [status, promptPending, legalUpdatePending])
}
