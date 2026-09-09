import React, { forwardRef } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { View as RNView } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, webHover, webTransition } from "../theme"
import { Icon, iconMap, type IconName } from "../typography"

export const HEADER_ICON_BUTTON_TARGET = 44
export const HEADER_ICON_BUTTON_CHIP = 38
export const HEADER_ICON_BUTTON_GLYPH = 18

export interface HeaderIconButtonProps {
  icon: IconName
  label: string
  onPress: () => void
  surface?: "glass" | "solid"
  expanded?: boolean
}

export const HeaderIconButton = forwardRef<RNView, HeaderIconButtonProps>(function HeaderIconButton(
  { icon, label, onPress, surface = "glass", expanded },
  ref,
) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      {...focusRingProps}
      style={(state) => [styles.target, webTransition, state.pressed ? styles.pressed : null]}
    >
      {(state) => (
        <View
          style={[
            styles.chip,
            surface === "solid" ? styles.chipSolid : null,
            webHover(state) ? styles.chipHovered : null,
          ]}
        >
          <Icon icon={iconMap[icon]} size={HEADER_ICON_BUTTON_GLYPH} color={t.colors.text} />
        </View>
      )}
    </Pressable>
  )
})

const useStyles = makeThemedStyles((t) => ({
  target: {
    width: HEADER_ICON_BUTTON_TARGET,
    height: HEADER_ICON_BUTTON_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: HEADER_ICON_BUTTON_TARGET / 2,
  },
  chip: {
    width: HEADER_ICON_BUTTON_CHIP,
    height: HEADER_ICON_BUTTON_CHIP,
    borderRadius: HEADER_ICON_BUTTON_CHIP / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.glass.sheet.input,
  },
  chipSolid: {
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  chipHovered: { backgroundColor: t.colors.surfaceTint },
  pressed: { opacity: 0.82, transform: [{ scale: 0.93 }] },
}))
