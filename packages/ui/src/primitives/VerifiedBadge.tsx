import React from "react"
import { View, StyleSheet } from "react-native"
import { BadgeCheck } from "lucide-react-native/icons"
import { useTheme } from "../theme"
import { useT } from "../i18n"

export type VerifiedBadgeSize = "sm" | "md"

export interface VerifiedBadgeProps {
  size?: VerifiedBadgeSize
  color?: string
  label?: string
}

const SIZES: Record<VerifiedBadgeSize, number> = { sm: 14, md: 18 }

export function VerifiedBadge({ size = "sm", color, label }: VerifiedBadgeProps) {
  const { t } = useT("common")
  const th = useTheme()
  const glyph = SIZES[size]
  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={label ?? t("verified_badge")}
    >
      <BadgeCheck
        size={glyph}
        color={th.colors.onAccent}
        fill={color ?? th.colors.brand.sky}
        strokeWidth={2.25}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
})
