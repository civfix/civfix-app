import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { SupportedLocale } from "@civfix/shared"
import { makeThemedStyles, useTheme, useLayoutMode, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useScrollHost } from "../shell/ScrollHost"
import { useLocale, useT, supportedLocales } from "../i18n"

function LocaleRow({
  nativeName,
  selected,
  selectedLabel,
  onPress,
}: {
  nativeName: string
  selected: boolean
  selectedLabel: string
  onPress: () => void
}) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={nativeName}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <Text style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]} numberOfLines={1}>
        {nativeName}
      </Text>
      {selected ? (
        <View style={styles.check} accessibilityLabel={selectedLabel}>
          <Icon icon={iconMap.Check} size={16} color={t.colors.onAccent} />
        </View>
      ) : (
        <View style={styles.radioEmpty} />
      )}
    </Pressable>
  )
}

export function LanguageSettingsBody() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const { locale, setLocale } = useLocale()
  const { t } = useT("language-settings")
  const headerTitlesPanel = useLayoutMode() === "expanded"

  const onSelect = useCallback(
    (code: SupportedLocale) => {
      if (code !== locale) setLocale(code)
    },
    [locale, setLocale],
  )

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
      <View style={styles.list} accessibilityRole="radiogroup">
        {supportedLocales.map((l) => (
          <LocaleRow
            key={l.code}
            nativeName={l.nativeName}
            selected={l.code === locale}
            selectedLabel={t("selected")}
            onPress={() => onSelect(l.code)}
          />
        ))}
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
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 20,
    color: t.colors.text,
  },
  subtitle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    color: t.colors.textSubtle,
    marginTop: t.space["1"],
    marginBottom: t.space["4"],
  },
  subtitleAlone: {
    marginTop: 0,
  },
  list: {
    gap: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 15,
    ...t.shadows.s1,
  },
  rowSelected: {
    borderColor: t.colors.brand.bloom,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 15,
    color: t.colors.text,
  },
  rowLabelSelected: {
    fontFamily: t.fontFamily.bodyBold,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.bloom,
  },
  radioEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.colors.border,
  },
}))
