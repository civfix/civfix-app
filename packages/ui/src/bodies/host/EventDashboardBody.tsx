import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"

export function EventDashboardBody() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const { t } = useT("event-dashboard")

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t("title")}</Text>
      <View style={styles.tabs}>
        <Text style={styles.tab}>{t("tabs.personal")}</Text>
        <Text style={styles.tab}>{t("tabs.org")}</Text>
      </View>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["10"],
    gap: t.space["3"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  tabs: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  tab: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
