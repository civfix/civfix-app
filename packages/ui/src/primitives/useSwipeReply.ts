/**
 * Right-drag-to-reply for native chat rows, on plain PanResponder (no gesture-handler in this package).
 * Touch-down never claims, so child Pressables keep their taps; the capture handler still records the
 * start X because RN fills `gestureState.x0` only at grant, after the move negotiation that needs it.
 * Once engaged the gesture refuses termination so the list cannot steal it mid-swipe. Web is inert: the
 * web bubble has hover actions instead.
 */
import { useMemo, useRef } from "react"
import { Animated, PanResponder, Platform, type GestureResponderHandlers } from "react-native"
import { useHaptics } from "../capabilities"
import { shouldCaptureSwipe, shouldTriggerReply, swipeProgress, swipeTranslate } from "./swipeReplyModel"
import { createSwipeStartTracker } from "./swipeStartTracker"

const SETTLE_SPRING = { tension: 120, friction: 12 } as const
const SETTLE_FADE_MS = 140

export interface SwipeReplyOptions {
  enabled: boolean
  onTrigger: () => void
}

export interface SwipeReply {
  active: boolean
  panHandlers: GestureResponderHandlers | Record<string, never>
  translateX: Animated.Value
  progress: Animated.Value
}

export function useSwipeReply({ enabled, onTrigger }: SwipeReplyOptions): SwipeReply {
  const haptics = useHaptics()
  const isNative = Platform.OS !== "web"
  // The PanResponder is created once, so its callbacks read the latest props through this ref.
  const stateRef = useRef({ enabled, onTrigger, haptics })
  stateRef.current = { enabled, onTrigger, haptics }
  const tickedRef = useRef(false)

  const translateX = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(0)).current
  const startTracker = useRef(createSwipeStartTracker()).current

  const responder = useMemo(() => {
    if (!isNative) return null
    const settle = () => {
      // Both values only drive transform and opacity, so the native driver is safe.
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, ...SETTLE_SPRING }).start()
      Animated.timing(progress, { toValue: 0, duration: SETTLE_FADE_MS, useNativeDriver: true }).start()
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: (evt) => {
        startTracker.noteTouchStart(evt.nativeEvent.pageX)
        return false
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        stateRef.current.enabled && shouldCaptureSwipe(g.dx, g.dy, startTracker.startX()),
      onPanResponderGrant: () => {
        tickedRef.current = false
      },
      onPanResponderMove: (_evt, g) => {
        translateX.setValue(swipeTranslate(g.dx))
        progress.setValue(swipeProgress(g.dx))
        if (!tickedRef.current && shouldTriggerReply(g.dx)) {
          tickedRef.current = true
          stateRef.current.haptics.impactLight()
        }
      },
      onPanResponderRelease: (_evt, g) => {
        if (shouldTriggerReply(g.dx)) stateRef.current.onTrigger()
        settle()
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => false,
    })
  }, [isNative, translateX, progress, startTracker])

  return {
    active: isNative && enabled,
    panHandlers: responder ? responder.panHandlers : {},
    translateX,
    progress,
  }
}
