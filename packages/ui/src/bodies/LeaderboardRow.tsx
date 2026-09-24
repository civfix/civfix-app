import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { LeaderboardEntryDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webHover, webTransition } from "../theme"
import { Avatar, LIST_ROW_MIN_HEIGHT } from "../primitives"
import { Text, Icon, iconMap } from "../typography"
import { useNavStore } from "../nav"
import { useLocale, useT } from "../i18n"
import { formatHoursDisplay } from "./formatHours"
import { SEARCH_RESULT_CARD_LAYOUT } from "./search/searchResultsModel"

export type LeaderboardRowEmphasis = "accent" | "ink"

export interface LeaderboardRowProps {
  entry: LeaderboardEntryDTO
  you?: boolean
  emphasis?: LeaderboardRowEmphasis
}

export function LeaderboardRow({ entry, you = false, emphasis = "accent" }: LeaderboardRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("leaderboard")
  const { locale } = useLocale()
  const hours = formatHoursDisplay(entry.hours, locale)
  const name = you ? t("row.you") : entry.name
  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "person", id: entry.handle ?? entry.userId })}
      accessibilityRole="button"
      accessibilityLabel={t("row.a11y", { rank: entry.rank, name, hours })}
      accessibilityHint={t("event-dashboard:top_volunteers.open_hint")}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        emphasis === "accent" ? styles.rowCard : null,
        webTransition,
        webHover(state) ? styles.rowHovered : null,
        you ? styles.leaderYouRow : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.leaderRank} numberOfLines={1}>{entry.rank}</Text>
      <Avatar
        name={entry.name}
        seed={entry.userId}
        photoUrl={entry.avatarUrl ?? null}
        gradient={entry.avatar ?? null}
        size={40}
      />
      <View style={styles.rowCopy}>
        <View style={styles.leaderNameRow}>
          <Text style={styles.leaderName} numberOfLines={1}>{name}</Text>
        </View>
        {entry.handle ? <Text style={styles.leaderHandle} numberOfLines={1}>@{entry.handle}</Text> : null}
      </View>
      <Text
        style={[styles.leaderHours, emphasis === "ink" ? styles.leaderHoursInk : null]}
        numberOfLines={1}
      >
        {t("hours_unit", { hours })}
      </Text>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["4"],
  },
  rowCard: {
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  rowHovered: { backgroundColor: t.colors.surfaceTint, borderColor: t.colors.borderStrong },
  rowCopy: { flex: 1, minWidth: 0, gap: t.space["1"] },
  leaderRank: {
    width: t.space["6"],
    flexShrink: 0,
    textAlign: "center",
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
    color: t.colors.textSubtle,
  },
  leaderNameRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"], minWidth: 0 },
  leaderName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
    color: t.colors.text,
  },
  leaderHandle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  leaderHours: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.accentText,
  },
  leaderHoursInk: { color: t.colors.text },
  leaderYouRow: { borderWidth: 1.5, borderColor: t.colors.moss["100"] },
  pressed: { opacity: 0.65 },
}))
