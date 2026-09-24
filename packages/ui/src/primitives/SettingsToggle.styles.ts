import type { ViewStyle } from "react-native"
import { alpha } from "../theme/alpha"
import type { Theme } from "../theme"

export const TRACK_OFF_ALPHA = 0.16

export function trackOffColor(t: Theme): string {
  return alpha(t.colors.text, TRACK_OFF_ALPHA)
}

export const KNOB_OFF_X = 2
export const KNOB_ON_X = 18

export const SETTINGS_TOGGLE_TRACK: ViewStyle = {
  width: 40,
  height: 24,
  borderRadius: 12,
  justifyContent: "center",
  flexShrink: 0,
}

export function settingsToggleKnob(t: Theme): ViewStyle {
  return {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: t.colors.onAccent,
  }
}
