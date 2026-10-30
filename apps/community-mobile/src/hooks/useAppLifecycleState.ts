import { useEffect, useState } from "react"
import { AppState } from "react-native"
import type { AppLifecycleState } from "@/lib/lifecycleTypes"

export function useAppLifecycleState(): AppLifecycleState {
  const [appState, setAppState] = useState<AppLifecycleState>(
    AppState.currentState,
  )
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setAppState(next),
    )
    return () => sub.remove()
  }, [])
  return appState
}
