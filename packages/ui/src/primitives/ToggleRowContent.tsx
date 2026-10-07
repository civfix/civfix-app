import React from "react"
import { Pressable, type StyleProp, type ViewStyle } from "react-native"
import { useTheme, focusRingProps, webCursor } from "../theme"
import { SettingsToggle } from "./SettingsToggle"

/**
 * The switch is the row's one screen-reader and tab stop; the label column stays clickable but is hidden
 * from both, so a toggle row is never announced twice.
 */
export function ToggleRowContent({
  label,
  hint,
  value,
  onValueChange,
  columnStyle,
  children,
}: {
  label: string
  hint: string | undefined
  value: boolean
  onValueChange: (next: boolean) => void
  columnStyle: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <>
      <Pressable
        onPress={() => onValueChange(!value)}
        focusable={false}
        {...({ tabIndex: -1 } as object)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...focusRingProps}
        style={[columnStyle, webCursor()]}
      >
        {children}
      </Pressable>
      <SettingsToggle
        value={value}
        onValueChange={onValueChange}
        onColor={t.colors.brand.bloom}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </>
  )
}
