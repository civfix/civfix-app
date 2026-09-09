import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, PanResponder, Platform, type GestureResponderHandlers } from "react-native"
import { useHaptics } from "../capabilities"
import { theme } from "../theme"
import {
  actionsProgress,
  actionsRestingX,
  actionsTranslate,
  actionsWidth,
  shouldCaptureActionsSwipe,
  shouldSnapOpen,
} from "./swipeActionsModel"

let openRowCloser: (() => void) | null = null

export function closeOpenSwipeActions(): boolean {
  const closer = openRowCloser
  if (closer === null) return false
  closer()
  return true
}

export interface SwipeActionsOptions {
  enabled: boolean
  actionCount: number
}

export interface SwipeActions {
  active: boolean
  open: boolean
  width: number
  panHandlers: GestureResponderHandlers | Record<string, never>
  translateX: Animated.Value
  progress: Animated.Value
  close: () => void
}

export function useSwipeActions({ enabled, actionCount }: SwipeActionsOptions): SwipeActions {
  const haptics = useHaptics()
  const isNative = Platform.OS !== "web"
  const width = actionsWidth(actionCount)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const tickedRef = useRef(false)
  const translateX = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(0)).current
  const stateRef = useRef({ enabled, width, haptics })
  stateRef.current = { enabled, width, haptics }

  const settle = useCallback(
    (next: boolean) => {
      openRef.current = next
      setOpen(next)
      const duration = theme.motion.fade.duration
      const easing = Easing.bezier(...theme.motion.easing)
      Animated.timing(translateX, {
        toValue: actionsRestingX(next, stateRef.current.width),
        duration,
        easing,
        useNativeDriver: true,
      }).start()
      Animated.timing(progress, {
        toValue: next ? 1 : 0,
        duration,
        easing,
        useNativeDriver: true,
      }).start()
    },
    [translateX, progress],
  )

  const closeRef = useRef<() => void>(() => {})
  const snapClosed = useCallback(() => {
    if (openRowCloser === closeRef.current) openRowCloser = null
    settle(false)
  }, [settle])
  const close = useCallback(() => {
    if (openRef.current) snapClosed()
  }, [snapClosed])
  closeRef.current = close

  const closeOtherRow = useCallback(() => {
    const other = openRowCloser
    if (other && other !== closeRef.current) other()
  }, [])

  const openActions = useCallback(() => {
    closeOtherRow()
    openRowCloser = closeRef.current
    settle(true)
  }, [closeOtherRow, settle])

  useEffect(
    () => () => {
      if (openRowCloser === closeRef.current) openRowCloser = null
    },
    [],
  )

  useEffect(() => {
    if (!openRef.current) return
    if (!enabled || width <= 0) close()
    else settle(true)
  }, [enabled, width, close, settle])

  const responder = useMemo(() => {
    if (!isNative) return null
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        stateRef.current.enabled &&
        stateRef.current.width > 0 &&
        shouldCaptureActionsSwipe(g.dx, g.dy, openRef.current),
      onPanResponderGrant: () => {
        tickedRef.current = false
        closeOtherRow()
      },
      onPanResponderMove: (_evt, g) => {
        const w = stateRef.current.width
        const x = actionsTranslate(g.dx, actionsRestingX(openRef.current, w), w)
        translateX.setValue(x)
        progress.setValue(actionsProgress(x, w))
        if (!tickedRef.current && shouldSnapOpen(x, w, 0) !== openRef.current) {
          tickedRef.current = true
          stateRef.current.haptics.impactLight()
        }
      },
      onPanResponderRelease: (_evt, g) => {
        const w = stateRef.current.width
        const x = actionsTranslate(g.dx, actionsRestingX(openRef.current, w), w)
        if (shouldSnapOpen(x, w, g.vx)) openActions()
        else snapClosed()
      },
      onPanResponderTerminate: () => settle(openRef.current),
      onPanResponderTerminationRequest: () => false,
    })
  }, [isNative, translateX, progress, closeOtherRow, openActions, snapClosed, settle])

  const active = isNative && enabled && width > 0
  return {
    active,
    open,
    width,
    panHandlers: responder ? responder.panHandlers : {},
    translateX,
    progress,
    close,
  }
}
