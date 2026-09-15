import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Text } from "../typography"
import { makeThemedStyles, useTheme } from "../theme"
import { useT } from "../i18n"

export function MapPending() {
  const { t } = useT("map-ui")
  const th = useTheme()
  const styles = useStyles()

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} accessibilityRole="progressbar">
      <ActivityIndicator color={th.colors.textSubtle} />
      <Text variant="label" color={th.colors.textMuted}>
        {t("finding_area")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.bgAlt,
  },
}))
