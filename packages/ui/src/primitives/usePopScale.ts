/**
 * usePopScale - the shared "cfPop" confirmation spring, lifted VERBATIM out of `RsvpPill` (which was its
 * only owner) so the slot tile/pill and any future confirm affordance play the identical motion instead
 * of each re-deriving it.
 *
 * The animation: when `active` flips false -> true the returned `Animated.Value` snaps to
 * `motion.pop.from` (0.6) and springs to `motion.pop.to` (1), overshooting past ~`motion.pop.overshoot`
 * (1.08) on the way thanks to the token's low damping - the .6 -> 1.08 -> 1 feel without an explicit
 * keyframe timeline. Nothing plays on the true -> false return: this marks a CONFIRMATION, not a toggle.
 *
 * Three constraints this file exists to keep, all of them deliberate:
 *   1. NATIVE ONLY. Gated on `Platform.OS !== "web"` so a web render's DOM and behaviour are byte-identical
 *      to a version without any of this - callers render the plain child on web.
 *   2. REDUCE MOTION is honoured, both the value read at mount and later changes to it.
 *   3. TRANSFORM ONLY, so `useNativeDriver: true` is safe on every platform. Do not extend this to animate
 *      layout, colour or opacity-plus-layout without revisiting that flag.
 *
 * Deliberately plain react-native `Animated`, NOT reanimated: this module is imported by primitives that
 * render inside the sheet, and the 0.36.1 worklet-factory crash class lives on the reanimated side.
 */
import { useEffect, useRef } from "react"
import { AccessibilityInfo, Animated, Platform } from "react-native"
import { motion } from "../theme"

/** cfPop is native decoration only; web keeps its unchanged static render. */
export const POP_ENABLED = Platform.OS !== "web"

/**
 * A scale `Animated.Value` that pops once each time `active` goes false -> true.
 *
 * Apply it as a TRANSFORM on a thin wrapper (`<Animated.View style={{ transform: [{ scale }] }}>`) so it
 * never collides with the child's own pressed-state transform, and only when {@link POP_ENABLED}.
 */
export function usePopScale(active: boolean): Animated.Value {
  const popScale = useRef(new Animated.Value(1)).current
  const prevActiveRef = useRef(active)
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    if (!POP_ENABLED) return
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) reduceMotionRef.current = !!enabled
      })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotionRef.current = !!enabled
    })
    return () => {
      mounted = false
      sub?.remove()
    }
  }, [])

  useEffect(() => {
    const wasActive = prevActiveRef.current
    prevActiveRef.current = active
    // Only pop on the false -> true confirmation, and never on web / reduce-motion.
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
