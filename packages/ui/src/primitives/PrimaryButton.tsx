import React from "react"
import {
  Pressable,
  View,
  ActivityIndicator,
  type ViewStyle,
  type StyleProp,
} from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webNoSelect,
  webHover,
  focusRingProps,
  type Theme,
} from "../theme"
import { Text, type LucideIcon } from "../typography"

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost"

export interface PrimaryButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  icon?: LucideIcon
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

function contentColor(variant: ButtonVariant, t: Theme): string {
  switch (variant) {
    case "primary":
    case "dark":
      return t.colors.onAccent
    default:
      return t.colors.text
  }
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon: IconCmp,
  accessibilityLabel,
  style,
}: PrimaryButtonProps) {
  const styles = useStyles()
  const t = useTheme()
  const isDisabled = disabled || loading
  const fg = contentColor(variant, t)

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...focusRingProps}
      style={(state) => [
        styles.base,
        webTransition,
        webCursor(isDisabled),
        variant === "primary" ? styles.primary : null,
        variant === "primary" ? t.shadows.pin : null,
        variant === "dark" ? styles.dark : null,
        variant === "outline" ? styles.outline : null,
        variant === "ghost" ? styles.ghost : null,
        webHover(state) && !isDisabled ? styles.hovered : null,
        state.pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {IconCmp ? <IconCmp size={18} color={fg} /> : null}
          <Text variant="bodyStrong" color={fg} style={webNoSelect}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  base: {
    height: 52,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["5"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  primary: {
    backgroundColor: t.colors.brand.bloom,
  },
  dark: {
    backgroundColor: t.colors.text,
  },
  outline: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  hovered: {
    opacity: 0.94,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
}))
