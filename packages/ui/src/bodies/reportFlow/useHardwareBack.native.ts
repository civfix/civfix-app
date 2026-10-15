import { useEffect } from "react"
import { BackHandler } from "react-native"

/** Android's back button calls `onBack`, and goes no further, while `enabled`. */
export function useHardwareBack(enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [enabled, onBack])
}
