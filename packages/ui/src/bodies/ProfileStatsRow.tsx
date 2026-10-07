import React from "react"
import { Pressable, View } from "react-native"
import type { UserProfileDTO } from "@civfix/shared"
import { makeThemedStyles, focusRingProps, webCursor, webNoSelect, webTransition, MIN_TOUCH_TARGET } from "../theme"
import { Text, TextLink } from "../typography"
import { useT } from "../i18n"
import { formatPostActionCount } from "../primitives/postActionModel"

export type ProfileConnectionKey = "followers" | "following"

export interface ProfileStatItem {
  key: "following" | "followers" | "reports" | "fixed" | "cleanups"
  value: number
  labelKey: string
  connection: ProfileConnectionKey | null
}

export interface ProfileStatsSource {
  followers: number
  following: number
  stats: UserProfileDTO["stats"]
}

export function buildProfileStats(source: ProfileStatsSource): ProfileStatItem[] {
  return [
    { key: "following", value: source.following, labelKey: "stats.following", connection: "following" },
    { key: "followers", value: source.followers, labelKey: "stats.followers", connection: "followers" },
    { key: "reports", value: source.stats.reports, labelKey: "stats.reports", connection: null },
    { key: "fixed", value: source.stats.fixed, labelKey: "stats.fixed", connection: null },
    { key: "cleanups", value: source.stats.cleanups, labelKey: "stats.cleanups", connection: null },
  ]
}

export interface ProfileStatsRowProps extends ProfileStatsSource {
  onOpenConnections?: (which: ProfileConnectionKey) => void
}

export function ProfileStatsRow({
  followers,
  following,
  stats,
  onOpenConnections,
}: ProfileStatsRowProps) {
  const styles = useStyles()
  const { t } = useT("profile-view")
  const items = buildProfileStats({ followers, following, stats })

  const renderStat = (item: ProfileStatItem) => {
    const label = t(item.labelKey, { count: item.value })
    const count = formatPostActionCount(item.value)
    const which = item.connection
    const onPress = which != null && onOpenConnections != null ? () => onOpenConnections(which) : null
    const pressable = onPress != null
    const content = (
      <>
        <Text style={styles.count}>{count}</Text>
        {pressable ? (
          <TextLink style={styles.label} numberOfLines={1}>
            {label}
          </TextLink>
        ) : (
          <Text style={[styles.label, styles.labelPlain]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </>
    )
    if (!onPress) {
      return (
        <View key={item.key} style={styles.stat}>
          {content}
        </View>
      )
    }
    return (
      <Pressable
        key={item.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${count} ${label}`}
        {...focusRingProps}
        style={(state) => [
          styles.stat,
          webNoSelect,
          webTransition,
          webCursor(),
          state.pressed ? styles.statPressed : null,
        ]}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.row}>{items.map(renderStat)}</View>
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: t.space["3"],
  },
  stat: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.xs,
  },
  statPressed: {
    opacity: 0.7,
  },
  count: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["15"],
    lineHeight: 19,
    color: t.colors.text,
  },
  label: {
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: 14,
  },
  labelPlain: {
    color: t.colors.textSubtle,
  },
}))
