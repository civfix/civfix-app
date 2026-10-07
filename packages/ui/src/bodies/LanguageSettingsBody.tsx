import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { SupportedLocale } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useLocale, useT, supportedLocales } from "../i18n"
import { SettingsSubpage } from "./settings/SettingsSubpage"

function LocaleRow({
  nativeName,
  selected,
  onPress,
}: {
  nativeName: string
  selected: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
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
        <View style={styles.check}>
          <Icon icon={iconMap.Check} size={16} color={t.colors.onAccent} />
        </View>
      ) : (
        <View style={styles.radioEmpty} />
      )}
    </Pressable>
  )
}

export function LanguageSettingsBody() {
  const styles = useStyles()
  const { locale, setLocale } = useLocale()
  const { t } = useT("language-settings")

  const onSelect = useCallback(
    (code: SupportedLocale) => {
      if (code !== locale) setLocale(code)
    },
    [locale, setLocale],
  )

  return (
    <SettingsSubpage title={t("title")} subtitle={t("subtitle")} subtitleStyle={styles.subtitle}>
      <View style={styles.list} accessibilityRole="radiogroup">
        {supportedLocales.map((l) => (
          <LocaleRow
            key={l.code}
            nativeName={l.nativeName}
            selected={l.code === locale}
            onPress={() => onSelect(l.code)}
          />
        ))}
      </View>
    </SettingsSubpage>
  )
}

const useStyles = makeThemedStyles((t) => ({
  subtitle: {
    fontSize: 13.5,
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
    fontSize: t.fontSize["15"],
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
