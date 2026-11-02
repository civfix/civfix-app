import { Pressable, View } from "react-native"
import {
  makeThemedStyles,
  motion,
  useReducedMotion,
  useTheme,
  webCursor,
  focusRingProps,
  webStyle,
} from "../theme"
import { alpha } from "../theme/alpha"
import type { SettingsToggleProps } from "./SettingsToggle.types"
import {
  trackOffColor,
  KNOB_OFF_X,
  KNOB_ON_X,
  SETTINGS_TOGGLE_TRACK,
  settingsToggleKnob,
} from "./SettingsToggle.styles"

const KNOB_TRANSITION = `transform ${motion.dur.d2}ms ${motion.ease.spring}`

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
  const knobStyle = webStyle({
    transform: [{ translateX: value ? KNOB_ON_X : KNOB_OFF_X }],
    transition: still ? undefined : KNOB_TRANSITION,
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
      <View style={[styles.knob, knobStyle]} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: SETTINGS_TOGGLE_TRACK,
  knob: {
    ...settingsToggleKnob(t),
    boxShadow: `0 2px 4px ${alpha(t.colors.shadowColor, 0.2)}`,
  },
}))
