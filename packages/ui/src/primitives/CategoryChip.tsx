import React from "react"
import { View } from "react-native"
import { REPORT_CATEGORY_LABELS, type ReportCategory } from "@civfix/shared"
import { makeThemedStyles, useTheme, categoryColor, wash } from "../theme"
import { Text } from "../typography"
import { CATEGORY_ICONS } from "./category-icons"

export function CategoryChip({
  category,
  size = 40,
  showLabel = false,
}: {
  category: ReportCategory
  size?: number
  showLabel?: boolean
}) {
  const styles = useStyles()
  const t = useTheme()
  const color = categoryColor(category, t.scheme)
  const Glyph = CATEGORY_ICONS[category]
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.swatch,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            backgroundColor: wash(color, 0.82, t),
          },
        ]}
      >
        <Glyph size={size * 0.5} color={color} />
      </View>
      {showLabel ? (
        <Text variant="bodyStrong" color={t.colors.text} style={styles.label}>
          {REPORT_CATEGORY_LABELS[category]}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  swatch: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginLeft: t.space["2"],
  },
}))
