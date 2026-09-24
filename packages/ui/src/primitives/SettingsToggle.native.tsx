import React from "react"
import { Pressable } from "react-native"
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated"
import { makeThemedStyles, useReducedMotion, useTheme, webCursor, focusRingProps } from "../theme"
import type { SettingsToggleProps } from "./SettingsToggle.types"
import {
  trackOffColor,
  KNOB_OFF_X,
  KNOB_ON_X,
  SETTINGS_TOGGLE_TRACK,
  settingsToggleKnob,
} from "./SettingsToggle.styles"

const SPRING = { damping: 14, stiffness: 220, mass: 0.6 } as const

export function SettingsToggle({
  value,
  onValueChange,
  onColor,
  accessibilityLabel,
  accessibilityHint,
}: SettingsToggleProps) {
  const styles = useStyles()
  const t = useTheme()
  const still = useReducedMotion() !== false
  const knobStyle = useAnimatedStyle(() => {
    const x = value ? KNOB_ON_X : KNOB_OFF_X
    return { transform: [{ translateX: still ? x : withSpring(x, SPRING) }] }
  })

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
  track: SETTINGS_TOGGLE_TRACK,
  knob: {
    ...settingsToggleKnob(t),
    shadowColor: t.colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
}))
