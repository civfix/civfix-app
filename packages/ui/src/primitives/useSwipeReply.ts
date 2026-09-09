/**
 * useSwipeReply (P2 Task 2.8) - PanResponder-based right-drag-to-reply for NATIVE chat bubble rows.
 * NO react-native-gesture-handler anywhere in this package (house rule) - plain PanResponder, like
 * useDoubleTap is plain Pressable timing.
 *
 * The caller spreads `panHandlers` on the (static) row wrap and renders the row content inside an
 * Animated.View driven by `translateX`; `progress` (0..1 toward the trigger threshold) drives the
 * reply-hint icon's opacity. All thresholds live in swipeReplyModel (pure, unit-tested).
 *
 * Responder-chain contract (why bubble taps keep working):
 * - `onStartShouldSetPanResponder(Capture)` are BOTH false: touch-down never claims, so the child
 *   Pressables (bubble long-press/double-tap, ReplyQuote jump, reaction chips, mention links) receive
 *   presses exactly as before.
 * - `onMoveShouldSetPanResponder` claims only on a rightward, horizontally-dominant drag past slop
 *   (shouldCaptureSwipe). A child Pressable holding the responder gets a termination request and RN's
 *   Pressability cancels cleanly (no stray press/long-press fires mid-swipe). Vertical drags never
 *   match, so the FlatList scroll wins them; left drags never match at all.
 * - `onPanResponderTerminationRequest` is false: once the swipe engaged, the list cannot steal it
 *   back mid-gesture (the standard swipe-row pattern).
 *
 * Web: the hook is inert (empty handlers, values parked at 0) - the web bubble has hover actions and
 * no drag affordance. Haptics: one impact tick per gesture on first crossing the trigger threshold,
 * via the optional haptics capability (no-op where the host provides none).
 */
import { useMemo, useRef } from "react"
import { Animated, PanResponder, Platform, type GestureResponderHandlers } from "react-native"
import { useHaptics } from "../capabilities"
import { shouldCaptureSwipe, shouldTriggerReply, swipeProgress, swipeTranslate } from "./swipeReplyModel"

export interface SwipeReplyOptions {
  /** Row-level gate (e.g. canReply && !pending && !failed && !tombstone). Read fresh per event. */
  enabled: boolean
  /** Fired ONCE on release past the trigger threshold (open the reply composer mode). */
  onTrigger: () => void
}

export interface SwipeReply {
  /** True when the gesture is live on this platform + row: gate the Animated wrapper on it. */
  active: boolean
  /** Spread onto the row wrap. Empty object on web / when disabled. */
  panHandlers: GestureResponderHandlers | Record<string, never>
  /** Row content translation (0..SWIPE_MAX_TRANSLATE_PX); attach as transform translateX. */
  translateX: Animated.Value
  /** 0..1 toward the trigger threshold; attach as the reply-hint icon's opacity. */
  progress: Animated.Value
}

export function useSwipeReply({ enabled, onTrigger }: SwipeReplyOptions): SwipeReply {
  const haptics = useHaptics()
  const isNative = Platform.OS !== "web"
  // Latest-props mirror (the useDoubleTap pattern): the PanResponder is created once, so its
  // callbacks read enabled/onTrigger/haptics through this ref instead of stale closures.
  const stateRef = useRef({ enabled, onTrigger, haptics })
  stateRef.current = { enabled, onTrigger, haptics }
  // One haptic tick per gesture: armed on grant, consumed on first threshold crossing.
  const tickedRef = useRef(false)

  const translateX = useRef(new Animated.Value(0)).current
  const progress = useRef(new Animated.Value(0)).current

  const responder = useMemo(() => {
    if (!isNative) return null
    const settle = () => {
      // Spring the row home; the hint fades on the same clock. Native driver: both values only ever
      // drive transform/opacity.
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 12 }).start()
      Animated.timing(progress, { toValue: 0, duration: 140, useNativeDriver: true }).start()
    }
    return PanResponder.create({
      // Never claim on touch-down: child Pressables keep their taps (contract above).
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, g) => stateRef.current.enabled && shouldCaptureSwipe(g.dx, g.dy),
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
      // Termination (should not happen - we refuse requests - but e.g. a native interruption): just settle.
      onPanResponderTerminate: settle,
      // Once engaged, keep the gesture: the list already lost the move negotiation.
      onPanResponderTerminationRequest: () => false,
    })
  }, [isNative, translateX, progress])

  return {
    active: isNative && enabled,
    panHandlers: responder ? responder.panHandlers : {},
    translateX,
    progress,
  }
}
