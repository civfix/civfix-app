import React from "react"
import { makeThemedStyles, useLayoutMode } from "../theme"
import { Text } from "../typography"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { AppearanceOptionList } from "./AppearanceOptionList"

export function AppearanceSettingsBody() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const { t } = useT("appearance-settings")
  const headerTitlesPanel = useLayoutMode() === "expanded"

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {headerTitlesPanel ? null : <Text style={styles.title}>{t("title")}</Text>}
      <Text style={[styles.subtitle, headerTitlesPanel ? styles.subtitleAlone : null]}>
        {t("subtitle")}
      </Text>
      <AppearanceOptionList />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  subtitle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.textSubtle,
    marginTop: t.space["1"],
    marginBottom: t.space["4"],
  },
  subtitleAlone: {
    marginTop: 0,
  },
}))
