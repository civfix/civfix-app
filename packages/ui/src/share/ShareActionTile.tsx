import React, { useEffect, useRef } from "react"
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, type Theme } from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import type { ShareTileTone } from "./shareSheetModel"

export interface ShareActionTileProps {
  icon: IconName
  label: string
  name?: string
  status?: string
  onPress: () => void
  disabled?: boolean
  tone?: ShareTileTone
}

const CIRCLE = 52

function toneColor(tone: ShareTileTone, t: Theme): string {
  switch (tone) {
    case "success":
      return t.colors.brand.moss
    case "danger":
      return t.colors.dangerInk
    default:
      return t.colors.text
  }
}

export function ShareActionTile({
  icon,
  label,
  name,
  status,
  onPress,
  disabled = false,
  tone = "default",
}: ShareActionTileProps) {
  const styles = useStyles()
  const th = useTheme()
  const color = toneColor(tone, th)
  const announced = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (status === undefined) {
      announced.current = undefined
      return
    }
    if (status === announced.current) return
    announced.current = status
    AccessibilityInfo.announceForAccessibility(status)
  }, [status])
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={name ?? label}
      accessibilityValue={status === undefined ? undefined : { text: status }}
      accessibilityState={{ disabled }}
      {...focusRingProps}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <View style={[styles.circle, tone === "default" ? null : { borderColor: color }]}>
        <Icon icon={iconMap[icon]} size={22} color={color} />
      </View>
      <Text variant="caption" color={color} numberOfLines={2} style={styles.label}>
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
