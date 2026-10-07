import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"

export interface CountBadgeProps {
  count: number
  size?: "sm" | "md"
}

export function CountBadge({ count, size = "md" }: CountBadgeProps): React.ReactElement | null {
  const styles = useStyles()
  const t = useTheme()
  if (count <= 0) return null
  const sm = size === "sm"
  return (
    <View style={[styles.badge, sm ? styles.badgeSm : styles.badgeMd]}>
      <Text variant="caption" color={t.colors.onAccent} style={sm ? styles.textSm : styles.textMd}>
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  badge: {
    backgroundColor: t.colors.brand.bloom,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSm: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: t.space["1"],
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: t.colors.neutral.card,
  },
  badgeMd: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  textSm: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 13,
  },
  textMd: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
  },
}))
