import React from "react"
import type { StyleProp, TextStyle } from "react-native"
import { makeThemedStyles, useLayoutMode } from "../../theme"
import { Text } from "../../typography"
import { useScrollHost } from "../../shell/ScrollHost"

export function SettingsSubpage({
  title,
  subtitle,
  subtitleStyle,
  children,
}: {
  title: string
  subtitle: string
  subtitleStyle?: StyleProp<TextStyle>
  children: React.ReactNode
}) {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  // In expanded layout the panel header already shows the title.
  const headerTitlesPanel = useLayoutMode() === "expanded"

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {headerTitlesPanel ? null : <Text style={styles.title}>{title}</Text>}
      <Text style={[styles.subtitle, subtitleStyle, headerTitlesPanel ? styles.subtitleAlone : null]}>
        {subtitle}
      </Text>
      {children}
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
