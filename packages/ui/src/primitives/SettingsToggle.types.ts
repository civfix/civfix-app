import { alpha } from "../theme/alpha"
import type { Theme } from "../theme"

export interface SettingsToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  onColor?: string
  accessibilityLabel?: string
  accessibilityHint?: string
}

export const TRACK_OFF_ALPHA = 0.16

export function trackOffColor(t: Theme): string {
  return alpha(t.colors.text, TRACK_OFF_ALPHA)
}

export const KNOB_OFF_X = 2
export const KNOB_ON_X = 18
