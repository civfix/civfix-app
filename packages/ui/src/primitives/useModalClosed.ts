import { useCallback, useEffect, useRef } from "react"
import { Platform } from "react-native"

export const MODAL_EMITS_DISMISS = Platform.OS !== "android"

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
