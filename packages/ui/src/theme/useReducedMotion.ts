import { useSyncExternalStore } from "react"
import { AccessibilityInfo } from "react-native"

let reducedMotionValue: boolean | null = null
let reducedMotionQueried = false
let reducedMotionSubscribed = false
const reducedMotionListeners = new Set<() => void>()

function setReducedMotion(next: boolean | null): void {
  if (next === reducedMotionValue) return
  reducedMotionValue = next
  for (const notify of reducedMotionListeners) notify()
}

function subscribeReducedMotion(notify: () => void): () => void {
  reducedMotionListeners.add(notify)
  if (!reducedMotionQueried) {
    reducedMotionQueried = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => setReducedMotion(value))
      .catch(() => setReducedMotion(false))
  }
  if (!reducedMotionSubscribed) {
    reducedMotionSubscribed = true
    AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion)
  }
  return () => {
    reducedMotionListeners.delete(notify)
  }
}

function readReducedMotion(): boolean | null {
  return reducedMotionValue
}

export function useReducedMotion(): boolean | null {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, readReducedMotion)
}
