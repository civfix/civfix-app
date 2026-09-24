/**
 * Plain react-native Animated, not reanimated: primitives inside the sheet import this, and reanimated is
 * where the worklet-factory crash class lives. Transform only, so the native driver is safe; animating
 * layout, colour or opacity would need that flag revisited.
 */
import { useEffect, useRef } from "react"
import { Animated, Platform } from "react-native"
import { motion } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"

export const POP_ENABLED = Platform.OS !== "web"

/** Apply on a thin wrapper so the scale never collides with the child's own pressed-state transform. */
export function usePopScale(active: boolean): Animated.Value {
  const popScale = useRef(new Animated.Value(1)).current
  const prevActiveRef = useRef(active)
  const reduceMotionRef = useRef(false)
  // An unanswered or failed OS probe reads as null and keeps the pop on.
  reduceMotionRef.current = useReducedMotion() === true

  useEffect(() => {
    const wasActive = prevActiveRef.current
    prevActiveRef.current = active
    if (!POP_ENABLED || !active || wasActive || reduceMotionRef.current) return
    popScale.stopAnimation()
    popScale.setValue(motion.pop.from)
    Animated.spring(popScale, {
      toValue: motion.pop.to,
      damping: motion.pop.spring.damping,
      stiffness: motion.pop.spring.stiffness,
      mass: motion.pop.spring.mass,
      useNativeDriver: true,
    }).start()
  }, [active, popScale])

  return popScale
}
