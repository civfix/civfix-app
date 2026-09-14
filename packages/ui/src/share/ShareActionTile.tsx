import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"

export interface ShareActionTileProps {
  icon: IconName
  label: string
  onPress: () => void
  disabled?: boolean
}

const CIRCLE = 52

export function ShareActionTile({ icon, label, onPress, disabled = false }: ShareActionTileProps) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      {...focusRingProps}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <View style={styles.circle}>
        <Icon icon={iconMap[icon]} size={22} color={th.colors.text} />
      </View>
      <Text variant="caption" numberOfLines={2} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  tile: {
    width: CIRCLE + t.space["6"],
    alignItems: "center",
    gap: t.space["1"],
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  label: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
}))
