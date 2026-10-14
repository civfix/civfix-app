import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"

export function ThreadEmptyReplies() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("thread.no_replies")}</Text>
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("thread.no_replies_hint")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["4"],
    paddingBottom: t.space["8"],
    gap: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
    color: t.colors.text,
  },
}))
