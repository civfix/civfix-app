import React from "react"
import { View, StyleSheet } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"

export type RoleChipTone = "neutral" | "lead" | "slot"

export interface RoleChipProps {
  label: string
  tone?: RoleChipTone
}

export function RoleChip({ label, tone = "neutral" }: RoleChipProps) {
  const styles = useStyles()
  return (
    <View
      style={[
        styles.chip,
        tone === "lead" ? styles.chipLead : null,
        tone === "slot" ? styles.chipSlot : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === "lead" ? styles.labelLead : null,
          tone === "slot" ? styles.labelSlot : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  chip: {
    flexShrink: 0,
    paddingHorizontal: t.space["2"],
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  chipLead: {
    backgroundColor: t.colors.moss["50"],
    borderColor: t.colors.moss["100"],
  },
  chipSlot: {
    flexShrink: 1,
    maxWidth: 120,
    backgroundColor: t.colors.sky["50"],
    borderColor: t.colors.sky["100"],
  },
  label: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 0.4,
    color: t.colors.textMuted,
  },
  labelLead: {
    color: t.colors.moss["700"],
  },
  labelSlot: {
    color: t.colors.sky["700"],
  },
}))
