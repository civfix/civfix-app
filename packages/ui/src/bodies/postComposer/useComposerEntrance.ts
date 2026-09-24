import { useEffect, useRef } from "react"
import { Animated, Easing, Platform, type ViewStyle } from "react-native"
import { useReducedMotion } from "../../theme/useReducedMotion"

const ENTRANCE_MS = 280
const ENTRANCE_RISE = 36
const ENTRANCE_SCALE_FROM = 0.99

export function useComposerEntrance(): Animated.WithAnimatedValue<ViewStyle> {
  const reducedMotion = useReducedMotion()
  const progress = useRef(new Animated.Value(reducedMotion === true ? 1 : 0)).current

  useEffect(() => {
    if (reducedMotion == null) return
    if (reducedMotion) {
      progress.stopAnimation()
      progress.setValue(1)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    })
    animation.start()
    return () => animation.stop()
  }, [progress, reducedMotion])

  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTRANCE_RISE, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTRANCE_SCALE_FROM, 1] }) },
    ],
  }
}
