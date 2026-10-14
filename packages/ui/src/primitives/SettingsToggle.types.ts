export interface SettingsToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  onColor?: string
  accessibilityLabel?: string
  accessibilityHint?: string
}
