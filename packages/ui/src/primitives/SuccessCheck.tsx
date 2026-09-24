import React, { useEffect, useMemo, useRef } from "react"
import { Animated, Easing, Platform, StyleSheet, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"
import { motion, useReducedMotion, useTheme } from "../theme"
import { announce as announceToScreenReader } from "../announce"

const VIEWBOX = 88
const CIRCLE_RADIUS = 40
const CHECK_PATH = "M30 46 L40 56 L60 34"
const CHECK_LENGTH = 45
const DRAW_DELAY_MS = 120
const DRAW_DURATION_MS = 360

// The draw drives the path's dash offset as an animated prop, so the stroke updates each frame without
// re-rendering the SVG through React state.
const AnimatedPath = Animated.createAnimatedComponent(Path)

export interface SuccessCheckProps {
  size?: number
  announce?: string
}

export function SuccessCheck({ size = 80, announce: message }: SuccessCheckProps) {
  const th = useTheme()
  const reducedMotion = useReducedMotion()
  const scale = useRef(new Animated.Value(motion.pop.from)).current
  const draw = useRef(new Animated.Value(0)).current
  const dashOffset = useMemo(
    () => draw.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0] }),
    [draw],
  )

  useEffect(() => {
    if (message) announceToScreenReader(message)
  }, [message])

  useEffect(() => {
    if (reducedMotion === null) return
    if (reducedMotion) {
      scale.setValue(motion.pop.to)
      draw.setValue(1)
      return
    }
    scale.setValue(motion.pop.from)
    draw.setValue(0)
    const run = Animated.parallel([
      Animated.spring(scale, {
        toValue: motion.pop.to,
        damping: motion.pop.spring.damping,
        stiffness: motion.pop.spring.stiffness,
        mass: motion.pop.spring.mass,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.sequence([
        Animated.delay(DRAW_DELAY_MS),
        Animated.timing(draw, {
          toValue: 1,
          duration: DRAW_DURATION_MS,
          easing: Easing.bezier(...motion.easing),
          useNativeDriver: false,
        }),
      ]),
    ])
    run.start()
    return () => run.stop()
  }, [reducedMotion, scale, draw])

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={CIRCLE_RADIUS}
            fill={th.colors.moss["50"]}
            stroke={th.colors.moss["500"]}
            strokeWidth={2}
          />
          <AnimatedPath
            d={CHECK_PATH}
            fill="none"
            stroke={th.colors.moss["700"]}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
})
