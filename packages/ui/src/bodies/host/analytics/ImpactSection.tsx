import React from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { BarChart } from "../../../charts"
import { useT } from "../../../i18n"
import { useAnalyticsStyles } from "./analyticsStyles"
import { breakdownBars } from "./chartBars"

export function ImpactSection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useAnalyticsStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const buckets = data.impact.hoursBuckets?.rows ?? []

  return (
    <View style={styles.block}>
      <Text variant="label">
        {t("page.hours_total", { hours: Math.round(data.kpis.hoursTotal ?? 0) })}
      </Text>
      {buckets.length > 0 ? (
        <BarChart
          bars={breakdownBars(buckets, th.colors.accent)}
          horizontal
          labelColor={th.colors.textMuted}
          accessibilityLabel={t("page.hours_distribution")}
        />
      ) : (
        <Text variant="caption">{t("page.hours_empty")}</Text>
      )}

      <Text variant="caption">
        {t("page.reports_line", {
          count: data.kpis.reportsLinked ?? 0,
          resolved: data.kpis.reportsResolved ?? 0,
        })}
      </Text>
      <Text variant="caption">
        {t("page.posts_line", { count: data.kpis.postsCreated ?? 0 })}
      </Text>
      {data.kpis.donationClicks ? (
        <Text variant="caption">
          {t("page.donations_line", { clicks: data.kpis.donationClicks })}
        </Text>
      ) : null}
    </View>
  )
}
