import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../../theme"
import { Text } from "../../../typography"
import { formatStatValue, SectionCard } from "../../../primitives"
import { useLocale, useT } from "../../../i18n"
import type { TopEventBar } from "./dashboardModel"

export interface TopEventsCardProps {
  bars: readonly TopEventBar[]
}

export function TopEventsCard({ bars }: TopEventsCardProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  return (
    <SectionCard label={t("top_events.section")}>
      <View style={styles.root}>
        {bars.map((bar) => (
          <View key={bar.key} style={styles.row}>
            <View style={styles.head}>
              <Text variant="caption" style={styles.label} numberOfLines={1}>
                {bar.label}
              </Text>
              <Text variant="caption">
                {t("top_events.seats", { count: formatStatValue(bar.value, locale) ?? bar.value })}
              </Text>
            </View>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityLabel={bar.label}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(bar.ratio * 100) }}
            >
              <View style={[styles.fill, { width: `${Math.max(2, bar.ratio * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  )
}

const BAR_HEIGHT = 8

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["3"],
  },
  row: {
    gap: t.space["1"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.chartTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.chartInk,
  },
}))
