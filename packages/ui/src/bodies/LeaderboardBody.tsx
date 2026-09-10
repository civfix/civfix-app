import React, { memo, useCallback } from "react"
import { View, StyleSheet, ActivityIndicator } from "react-native"
import type { LeaderboardEntryDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, iconMap } from "../typography"
import { Avatar, EmptyState, LoadingState } from "../primitives"
import { useJurisdictionLeaderboard } from "../data"
import { useScrollHost } from "../shell/ScrollHost"
import { useLocale, useT } from "../i18n"
import { formatHoursDisplay } from "./formatHours"

const LeaderboardRow = memo(function LeaderboardRow({ entry }: { entry: LeaderboardEntryDTO }) {
  const styles = useStyles()
  const { t } = useT("leaderboard")
  const { locale } = useLocale()
  const hoursLabel = t("hours_unit", { hours: formatHoursDisplay(entry.hours, locale) })
  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={t("row.a11y", {
        rank: entry.rank,
        name: entry.name,
        hours: formatHoursDisplay(entry.hours, locale),
      })}
    >
      <Text style={styles.rank} numberOfLines={1}>
        {entry.rank}
      </Text>
      <Avatar
        name={entry.name}
        seed={entry.userId}
        photoUrl={entry.avatarUrl ?? null}
        gradient={entry.avatar ?? null}
        size={44}
      />
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
          </Text>
        </View>
        {entry.handle ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{entry.handle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.hours} numberOfLines={1}>
        {hoursLabel}
      </Text>
    </View>
  )
})

const keyExtractor = (item: LeaderboardEntryDTO) => item.userId

export interface LeaderboardBodyProps {
  geoid: string
}

export function LeaderboardBody({ geoid }: LeaderboardBodyProps) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("leaderboard")
  const query = useJurisdictionLeaderboard(geoid)

  const pages = query.data?.pages ?? []
  const entries = pages.flatMap((p) => p.entries)
  const jurisdictionName = pages[0]?.jurisdictionName

  const heading = jurisdictionName
    ? t("title", { name: jurisdictionName })
    : t("title_generic")

  const onEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
  }, [query])

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntryDTO }) => <LeaderboardRow entry={item} />,
    [],
  )

  return (
    <FlatList
      data={entries}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={entries.length === 0 ? styles.listEmpty : styles.listContent}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={renderItem}
      ListHeaderComponent={
        entries.length > 0 ? (
          <Text style={styles.heading} accessibilityRole="header" numberOfLines={2}>
            {heading}
          </Text>
        ) : null
      }
      ListEmptyComponent={
        query.isLoading ? (
          <LoadingState skeleton="person" rows={8} />
        ) : query.isError ? (
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        ) : (
          <EmptyState
            variant="detail"
            icon={iconMap.Award}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        )
      }
      ListFooterComponent={
        entries.length > 0 && query.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={th.colors.textSubtle} />
          </View>
        ) : null
      }
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: 0,
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  heading: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    marginTop: t.space["3"],
    marginBottom: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rank: {
    width: 26,
    textAlign: "center",
    flexShrink: 0,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 16,
    color: t.colors.textSubtle,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.text,
  },
  handle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  hours: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14,
    color: t.colors.accentText,
  },
  footer: {
    paddingVertical: t.space["4"],
  },
}))
