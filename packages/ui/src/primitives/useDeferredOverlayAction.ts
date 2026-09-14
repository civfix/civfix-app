import { useCallback, useEffect, useRef } from "react"
import { Platform } from "react-native"
import { makeOverlayActionGate, overlayActionsDeferUntilClosed } from "./overlayActionGate"

const DEFER_UNTIL_CLOSED = overlayActionsDeferUntilClosed(Platform.OS)

export interface DeferredOverlayAction {
  run: (action: () => void) => void
  settled: () => void
}

export function useDeferredOverlayAction(
  visible: boolean,
  onClose: () => void,
  onClosed: (() => void) | undefined,
): DeferredOverlayAction {
  const gate = useRef(makeOverlayActionGate(DEFER_UNTIL_CLOSED)).current
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  useEffect(() => {
    if (visible) gate.reopened()
  }, [visible, gate])

  useEffect(() => () => gate.settle(), [gate])

  const run = useCallback(
    (action: () => void) => {
      onClose()
      gate.choose(action)
    },
    [onClose, gate],
  )

  const settled = useCallback(() => {
    gate.settle()
    onClosedRef.current?.()
  }, [gate])

  return { run, settled }
}
