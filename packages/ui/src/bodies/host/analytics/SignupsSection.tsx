import React from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse, SeriesPoint } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { Meter } from "../../../primitives"
import { BarChart, useMeasuredWidth } from "../../../charts"
import { useT } from "../../../i18n"
import { hasSeriesData, rangeSlice, weeklyXLabels, wholeEventSignups } from "../analyticsModel"
import { useWeekLabel } from "../useWeekLabel"
import { BARS_HEIGHT, useAnalyticsStyles } from "./analyticsStyles"
import { seriesBars } from "./chartBars"

function cancellationAt(points: readonly SeriesPoint[], index: number): number | undefined {
  const point = points[index]
  if (!point || point.suppressed || !point.value) return undefined
  return point.value
}

export function SignupsSection({
  data,
  days,
  now,
}: {
  data: GetEventAnalyticsResponse
  days: number | null
  now: number
}) {
  const styles = useAnalyticsStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const weekLabel = useWeekLabel()
  const { width, onLayout } = useMeasuredWidth()
  const daily = rangeSlice(data.signups.daily, days, now)
  const cancellations = rangeSlice(data.signups.cancellations, days, now)
  const capacity = data.kpis.capacity
  const signups = wholeEventSignups(data) ?? 0

  return (
    <View style={styles.block} onLayout={onLayout}>
      {capacity ? (
        <View style={styles.block}>
          <Text variant="label">{t("page.capacity_line", { signups, capacity })}</Text>
          <Meter
            value={signups}
            max={capacity}
            accessibilityLabel={t("page.capacity_line", { signups, capacity })}
          />
        </View>
      ) : null}

      {hasSeriesData(daily) ? (
        <>
          <Text variant="label">{t("registration.new")}</Text>
          <BarChart
            bars={seriesBars(daily, th.colors.accent).map((bar, index) => ({
              ...bar,
              stackValue: cancellationAt(cancellations, index),
              stackColor: th.colors.dangerWash,
            }))}
            xLabels={weeklyXLabels(daily, weekLabel)}
            width={width}
            height={BARS_HEIGHT}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("registration.over_time_a11y")}
          />
        </>
      ) : (
        <Text variant="caption">{t("page.signups_empty")}</Text>
      )}
    </View>
  )
}
