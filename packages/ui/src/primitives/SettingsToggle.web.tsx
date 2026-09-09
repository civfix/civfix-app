import React from "react"
import { Pressable, View, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme, webCursor, focusRingProps } from "../theme"
import { alpha } from "../theme/alpha"
import {
  type SettingsToggleProps,
  trackOffColor,
  KNOB_OFF_X,
  KNOB_ON_X,
} from "./SettingsToggle.types"

const KNOB_TRANSITION = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)"

export function SettingsToggle({
  value,
  onValueChange,
  onColor,
  accessibilityLabel,
}: SettingsToggleProps) {
  const styles = useStyles()
  const t = useTheme()
  const knobStyle = {
    transform: [{ translateX: value ? KNOB_ON_X : KNOB_OFF_X }],
    transition: KNOB_TRANSITION,
  } as unknown as ViewStyle

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
      <View style={[styles.knob, knobStyle]} />
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
    boxShadow: `0 2px 4px ${alpha(t.colors.shadowColor, 0.2)}`,
  },
}))
