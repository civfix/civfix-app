import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { AccessibilityInfo, Animated, Easing, StyleSheet, type LayoutChangeEvent } from "react-native"
import { motion } from "../theme"
import type { BodyTransitionProps } from "./BodyTransition.types"
import { bodyTransitionPlan } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"

const EASING = Easing.bezier(...motion.easing)

let reduceMotionCache = false

const SETTLE_GUARD_MS = 250

export function BodyTransition({ children, transitionKey, direction }: BodyTransitionProps) {
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const prevKeyRef = useRef(transitionKey)
  const reduceMotionRef = useRef(reduceMotionCache)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widthRef = useRef(0)

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
  }, [])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotionCache = !!enabled
        if (mounted) reduceMotionRef.current = !!enabled
      })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotionCache = !!enabled
      reduceMotionRef.current = !!enabled
    })
    return () => {
      mounted = false
      sub?.remove()
    }
  }, [])

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
  }, [transitionKey])

  return (
    <Animated.View onLayout={onLayout} style={[styles.host, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1, overflow: "hidden" },
})
