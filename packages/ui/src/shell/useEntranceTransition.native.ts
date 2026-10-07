import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { Animated, Easing, type LayoutChangeEvent } from "react-native"
import { motion } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import type { BodyTransitionDirection } from "./BodyTransition.types"
import { bodyTransitionPlan } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"

const EASING = Easing.bezier(...motion.easing)
const SETTLE_GUARD_MS = 250

export interface EntranceTransition {
  onLayout: (e: LayoutChangeEvent) => void
  animatedStyle: {
    opacity: Animated.Value
    transform: { translateX: Animated.Value }[]
  }
}

export function useEntranceTransition(
  transitionKey: string,
  direction: BodyTransitionDirection,
): EntranceTransition {
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const prevKeyRef = useRef(transitionKey)
  const widthRef = useRef(0)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotion = useReducedMotion() === true
  const reduceMotionRef = useRef(reduceMotion)
  useLayoutEffect(() => {
    reduceMotionRef.current = reduceMotion
  })

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
  }, [])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  useLayoutEffect(() => {
    if (transitionKey === prevKeyRef.current) return
    prevKeyRef.current = transitionKey

    const plan = bodyTransitionPlan(direction, reduceMotionRef.current, BODY_TIMING)

    opacity.stopAnimation()
    translateX.stopAnimation()
    if (settleTimer.current) clearTimeout(settleTimer.current)
    opacity.setValue(0)
    translateX.setValue(plan.fromRatio * widthRef.current)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: plan.fadeDuration,
        easing: EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: plan.slide ? plan.duration : 0,
        easing: EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      if (settleTimer.current) {
        clearTimeout(settleTimer.current)
        settleTimer.current = null
      }
    })
    settleTimer.current = setTimeout(
      () => {
        settleTimer.current = null
        opacity.stopAnimation()
        translateX.stopAnimation()
        opacity.setValue(1)
        translateX.setValue(0)
      },
      Math.max(plan.duration, plan.fadeDuration) + SETTLE_GUARD_MS,
    )
  }, [direction, opacity, transitionKey, translateX])

  return { onLayout, animatedStyle: { opacity, transform: [{ translateX }] } }
}
