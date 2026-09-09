import React from "react"
import { Pressable } from "react-native"
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated"
import { makeThemedStyles, useTheme, webCursor, focusRingProps } from "../theme"
import {
  type SettingsToggleProps,
  trackOffColor,
  KNOB_OFF_X,
  KNOB_ON_X,
} from "./SettingsToggle.types"

const SPRING = { damping: 14, stiffness: 220, mass: 0.6 } as const

export function SettingsToggle({
  value,
  onValueChange,
  onColor,
  accessibilityLabel,
}: SettingsToggleProps) {
  const styles = useStyles()
  const t = useTheme()
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(value ? KNOB_ON_X : KNOB_OFF_X, SPRING) }],
  }))

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      {...focusRingProps}
      style={[
        styles.track,
        webCursor(),
        { backgroundColor: value ? (onColor ?? t.colors.brand.bloom) : trackOffColor(t) },
      ]}
    >
      <Animated.View style={[styles.knob, knobStyle]} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    flexShrink: 0,
  },
  knob: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: t.colors.onAccent,
    shadowColor: t.colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
}))
