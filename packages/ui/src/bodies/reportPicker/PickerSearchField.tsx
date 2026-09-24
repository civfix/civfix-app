import React, { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, webCursorPointer, webInputReset } from "../../theme"
import { Icon, iconMap } from "../../typography"
import { TextInput } from "../../primitives"
import { useT } from "../../i18n"

const SEARCH_MIN_HEIGHT = 42

export function PickerSearchField({
  query,
  onChangeQuery,
  expanded,
}: {
  query: string
  onChangeQuery: (query: string) => void
  expanded: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-picker")
  const [searchFocused, setSearchFocused] = useState(false)
  return (
    <View style={[styles.search, searchFocused ? styles.searchFocused : null, expanded ? styles.searchPane : styles.searchFloat]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={t("search_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("search_a11y")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={[webInputReset, styles.searchInput]}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => onChangeQuery("")}
          accessibilityRole="button"
          accessibilityLabel={t("search_clear_a11y")}
          hitSlop={8}
          {...focusRingProps}
          style={webCursorPointer}
        >
          <Icon icon={iconMap.Close} size={16} color={th.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: SEARCH_MIN_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  searchFloat: {
    position: "absolute",
    top: t.space["3"],
    left: t.space["3"],
    right: t.space["3"],
    ...t.shadows.s2,
  },
  searchPane: {
    marginHorizontal: t.space["3"],
    marginTop: t.space["3"],
    backgroundColor: t.colors.surfaceTint,
  },
  searchFocused: {
    borderColor: t.colors.accent,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: t.space["2"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
}))
