import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"

export interface EventActionRowProps {
  icon: LucideIcon
  label: string
  onPress?: () => void
  disabled?: boolean
  hint?: string
  destructive?: boolean
  accessibilityLabel?: string
}

export function EventActionRow({
  icon,
  label,
  onPress,
  disabled = false,
  hint,
  destructive = false,
  accessibilityLabel,
}: EventActionRowProps) {
  const styles = useStyles()
  const t = useTheme()
  const iconColor = disabled
    ? t.colors.textSubtle
    : destructive
      ? t.colors.bloom["700"]
      : t.colors.textMuted

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursor(disabled),
        !disabled && webHover(state) ? styles.hovered : null,
        state.pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Icon icon={icon} size={16} color={iconColor} />
      <View style={styles.meta}>
        <Text
          style={[
            styles.label,
            destructive ? styles.labelDestructive : null,
            disabled ? styles.labelDisabled : null,
          ]}
        >
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {!disabled ? (
        <Icon icon={iconMap.ChevronRight} size={16} color={t.colors.textSubtle} />
      ) : null}
    </Pressable>
  )
}

export function EventActionRows({ children }: { children: React.ReactNode }) {
  const styles = useStyles()
  const rows = React.Children.toArray(children).filter(Boolean)
  return (
    <View>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
  },
  hovered: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.7,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  labelDestructive: {
    color: t.colors.bloom["700"],
  },
  labelDisabled: {
    color: t.colors.textSubtle,
  },
  hint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
