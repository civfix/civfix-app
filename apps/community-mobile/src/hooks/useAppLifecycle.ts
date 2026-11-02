import { useEffect } from "react"
import { AppState } from "react-native"
import { focusManager } from "@tanstack/react-query"
import { isFocused, shouldRevalidateOnState } from "@/lib/authLifecycle"
import { useAuthStore } from "@/store/authStore"

export function useAppLifecycle(): void {
  useEffect(() => {
    focusManager.setFocused(isFocused(AppState.currentState))

    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(isFocused(state))
      if (shouldRevalidateOnState(state)) void useAuthStore.getState().retryHydration()
    })

    return () => {
      subscription.remove()
      focusManager.setFocused(undefined)
    }
  }, [])
}
