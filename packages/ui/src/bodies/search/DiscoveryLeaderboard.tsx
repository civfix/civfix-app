import React from "react"
import { View } from "react-native"
import type { LeaderboardEntryDTO } from "@civfix/shared"
import { headingLevel } from "../../theme"
import { iconMap, Text } from "../../typography"
import { EmptyState } from "../../primitives"
import { useAuthState } from "../../data"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { LeaderboardRow } from "../LeaderboardRow"
import { LEADERBOARD_PREVIEW_LIMIT } from "../searchSuggestModel"
import { LinkAction } from "./LinkAction"
import { useSearchStyles } from "./searchStyles"

export function DiscoveryLeaderboard({
  geoid,
  name,
  entries,
  precededBySection = false,
  participantCount,
  viewerRank,
  viewerHours,
}: {
  geoid: string
  name: string | null
  entries: readonly LeaderboardEntryDTO[]
  precededBySection?: boolean
  participantCount?: number | null
  viewerRank?: number | null
  viewerHours?: number | null
}) {
  const styles = useSearchStyles()
  const { t } = useT("home-sidebar")
  const { user } = useAuthState()
  const isEmpty = entries.length === 0
  const youEntry: LeaderboardEntryDTO | null =
    user && typeof viewerRank === "number" && typeof viewerHours === "number" && viewerRank > LEADERBOARD_PREVIEW_LIMIT
      ? {
          rank: viewerRank,
          userId: user.id,
          name: user.displayName,
          handle: user.handle ?? null,
          avatarUrl: user.avatarUrl ?? null,
          hours: viewerHours,
        }
      : null

  return (
    <>
      <View style={[styles.sectionHeader, precededBySection ? styles.laterTitle : null]}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.sectionTitle}>
          {t("search_page.leaderboard")}
        </Text>
        <LinkAction
          label={t("search_page.see_all")}
          a11yLabel={t("search_page.leaderboard_see_all_a11y")}
          onPress={() => useNavStore.getState().push({ kind: "leaderboard", geoid })}
        />
      </View>
      {name && !isEmpty ? (
        <Text style={styles.leaderboardSub}>{t("search_page.leaderboard_in", { name })}</Text>
      ) : null}
      {isEmpty ? (
        <View style={styles.leaderboardEmpty}>
          <EmptyState
            variant="inline"
            icon={iconMap.Award}
            title={t("leaderboard:empty.title")}
            body={participantCount === 0 ? t("leaderboard:empty.body") : undefined}
          />
        </View>
      ) : (
        <View style={styles.suggestGroup}>
          {entries.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
          {youEntry ? <LeaderboardRow key={youEntry.userId} entry={youEntry} you /> : null}
        </View>
      )}
    </>
  )
}
