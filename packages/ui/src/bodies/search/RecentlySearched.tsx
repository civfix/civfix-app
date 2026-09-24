import React from "react"
import { Pressable, View } from "react-native"
import { focusRingProps, headingLevel, useTheme, webHover, webTransition } from "../../theme"
import { Icon, iconMap, Text } from "../../typography"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { useSearchRecentStore } from "./searchRecentStore"
import { LinkAction } from "./LinkAction"
import { useSearchStyles } from "./searchStyles"

export function RecentlySearched() {
  const styles = useSearchStyles()
  const th = useTheme()
  const { t } = useT("home-sidebar")
  const recent = useSearchRecentStore((state) => state.recent)
  const clear = useSearchRecentStore((state) => state.clear)
  const setQuery = useNavStore((state) => state.setQuery)
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.sectionTitle}>
          {t("search_page.recent")}
        </Text>
        {recent.length > 0 ? (
          <LinkAction
            label={t("search_page.clear")}
            a11yLabel={t("search_page.clear_a11y")}
            onPress={clear}
          />
        ) : null}
      </View>

      {recent.length > 0 ? (
        <View style={styles.recents}>
          {recent.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={t("search_page.recent_a11y", { query: item })}
              onPress={() => setQuery(item)}
              {...focusRingProps}
              style={(state) => [
                styles.recentRow,
                webTransition,
                state.pressed ? styles.pressed : webHover(state) ? styles.recentRowHovered : null,
              ]}
            >
              <View style={styles.recentIcon}>
                <Icon icon={iconMap.Clock} size={17} color={th.colors.textMuted} />
              </View>
              <Text style={styles.recentLabel} numberOfLines={1}>
                {item}
              </Text>
              <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyRecents}>{t("search_page.recent_empty")}</Text>
      )}
    </>
  )
}
