import { useEffect, useMemo, useRef } from "react"
import { Animated, Easing, Platform, type ViewStyle } from "react-native"
import { useReducedMotion } from "../theme/useReducedMotion"

export interface EntranceFrom {
  translateY: number
  scale?: number
}

/**
 * A one-shot fade-and-rise for a surface that just mounted. It holds the start frame until the reduced-motion
 * setting is known, and lands on the final frame without animating when motion is reduced.
 */
export function useEntranceAnimation({
  from,
  duration,
}: {
  from: EntranceFrom
  duration: number
}): Animated.WithAnimatedValue<ViewStyle> {
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
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    })
    animation.start()
    return () => animation.stop()
  }, [duration, progress, reducedMotion])

  const { translateY, scale } = from
  return useMemo(() => {
    const rise = { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [translateY, 0] }) }
    return {
      opacity: progress,
      transform:
        scale === undefined
          ? [rise]
          : [rise, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) }],
    }
  }, [progress, scale, translateY])
}
