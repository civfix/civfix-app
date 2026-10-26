import React from "react"
import { View } from "react-native"
import { Icon, Text, iconMap } from "../typography"
import { makeThemedStyles, useTheme } from "../theme"
import { useT } from "../i18n"

const GLYPH_SIZE = 22

export function MapUnavailable({ hint }: { hint: string }) {
  const { t } = useT("map-ui")
  const th = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.wrap} role="status">
      <Icon icon={iconMap.Map} size={GLYPH_SIZE} color={th.colors.textSubtle} />
      <Text variant="heading">{t("unavailable.title")}</Text>
      <Text variant="label" style={styles.hint}>
        {hint}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    padding: t.space["5"],
    backgroundColor: t.colors.bgAlt,
  },
  hint: {
    maxWidth: 320,
    textAlign: "center",
  },
}))
