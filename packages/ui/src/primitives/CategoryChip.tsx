import React from "react"
import { View } from "react-native"
import type { ReportCategory } from "@civfix/shared"
import { useT } from "../i18n"
import { makeThemedStyles, useTheme, categoryColor, wash } from "../theme"
import { Text } from "../typography"
import { CATEGORY_ICONS } from "./categoryIcons"

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
  const { t: tEnums } = useT("enums")
  const color = categoryColor(category, t.scheme)
  const Glyph = CATEGORY_ICONS[category]
  return (
    <View style={styles.row}>
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
          {tEnums(`category.${category}`)}
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
