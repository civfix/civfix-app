import React from "react"
import { Pressable, type StyleProp, type ViewStyle } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webNoSelect,
  webHover,
  focusRingProps,
} from "../theme"
import { Text, type LucideIcon } from "../typography"

export interface SecondaryButtonProps {
  label: string
  onPress: () => void
  icon?: LucideIcon
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  iconColor?: string
  pressedOpacity?: number
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function SecondaryButton({
  label,
  onPress,
  icon: IconCmp,
  size = "md",
  disabled = false,
  iconColor,
  pressedOpacity = 0.85,
  accessibilityLabel,
  style,
}: SecondaryButtonProps) {
  const styles = useStyles()
  const t = useTheme()
  const sm = size === "sm"
  const iconSize = sm ? 16 : 18
  const contentColor = disabled ? t.colors.textSubtle : t.colors.text
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      {...focusRingProps}
      style={(state) => [
        styles.base,
        webTransition,
        webCursor(disabled),
        sm ? styles.sm : size === "lg" ? styles.lg : styles.md,
        disabled ? styles.disabled : null,
        !disabled && webHover(state) ? styles.hovered : null,
        state.pressed && !disabled ? { opacity: pressedOpacity } : null,
        style,
      ]}
    >
      {IconCmp ? <IconCmp size={iconSize} color={iconColor ?? contentColor} /> : null}
      <Text
        variant={sm ? "label" : "bodyStrong"}
        color={contentColor}
        style={[sm ? styles.smLabel : null, webNoSelect]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  sm: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: t.space["3"],
  },
  md: {
    gap: t.space["2"],
    height: 44,
    paddingHorizontal: t.space["5"],
  },
  lg: {
    gap: t.space["2"],
    height: 52,
    paddingHorizontal: t.space["5"],
  },
  smLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  hovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  disabled: {
    opacity: 0.6,
    borderColor: t.colors.border,
  },
}))
