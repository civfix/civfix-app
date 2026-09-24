import { useCallback, useEffect, useRef, useState } from "react"
import { Platform } from "react-native"

const MODAL_EMITS_DISMISS = Platform.OS !== "android"

export function useModalClosed(shown: boolean, onClosed: (() => void) | undefined): (() => void) | undefined {
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const wasShown = useRef(shown)

  useEffect(() => {
    const left = wasShown.current && !shown
    wasShown.current = shown
    if (left && !MODAL_EMITS_DISMISS) onClosedRef.current?.()
  }, [shown])

  const onDismiss = useCallback(() => {
    onClosedRef.current?.()
  }, [])

  return MODAL_EMITS_DISMISS ? onDismiss : undefined
}

/**
 * Runs `reset` during the render in which `visible` turns true. A reset in an effect lands one commit
 * late, so a reopened sheet would paint the previous draft for a frame first.
 */
export function useResetOnOpen(visible: boolean, reset: () => void): void {
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) reset()
  }
}
