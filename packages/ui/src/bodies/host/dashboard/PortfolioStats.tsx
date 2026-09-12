import React from "react"
import { View } from "react-native"
import type { HostedEventsAnalyticsResponse } from "@civfix/shared"
import { makeThemedStyles } from "../../../theme"
import { Text } from "../../../typography"
import {
  formatRate,
  formatStatValue,
  SectionCard,
  SegmentedControl,
  sparklinePoints,
  StatTile,
  StatTileRow,
  suppressedSparkKeys,
  TrendSparkline,
  type StatTileColumns,
} from "../../../primitives"
import { useLocale, useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { TilesSkeleton } from "../HostSkeletons"
import {
  bestDayTimeParts,
  bestDayTimeShowable,
  DASHBOARD_RANGES,
  portfolioChartSeries,
  portfolioSuppressed,
  rateShowable,
  seriesChartable,
  seriesDayLabel,
  seriesEnd,
  type DashboardRange,
} from "./dashboardModel"

const TREND_HEIGHT = 24

export interface PortfolioStatsProps {
  analytics: HostedEventsAnalyticsResponse | undefined
  isPending: boolean
  isError: boolean
  range: DashboardRange
  columns: StatTileColumns
  onRange: (range: DashboardRange) => void
  onRetry: () => void
}

export function PortfolioStats({
  analytics,
  isPending,
  isError,
  range,
  columns,
  onRange,
  onRetry,
}: PortfolioStatsProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()

  const rangePicker = (
    <SegmentedControl
      size="sm"
      label={t("range.label")}
      selected={range}
      onSelect={(key) => onRange(key as DashboardRange)}
      options={DASHBOARD_RANGES.map((key) => ({ key, label: t(`range.${key}`) }))}
    />
  )

  if (isError) {
    return (
      <SectionCard label={t("numbers.section")} trailing={rangePicker}>
        <FeedNotice
          icon="CloudOff"
          title={t("kpi.error_title")}
          body={t("kpi.error_body")}
          actionLabel={t("kpi.retry")}
          onAction={onRetry}
        />
      </SectionCard>
    )
  }

  if (isPending || !analytics) {
    return (
      <SectionCard label={t("numbers.section")} trailing={rangePicker}>
        <View style={styles.root}>
          <TilesSkeleton columns={columns} />
          <TilesSkeleton columns={2} />
        </View>
      </SectionCard>
    )
  }

  const { totals, averageCheckInRate, repeatAttendance, series, bestDayTime, k } = analytics
  const chart = portfolioChartSeries(series)
  const end = seriesEnd(chart.points)
  const attendance = rateShowable(averageCheckInRate)
    ? formatRate(averageCheckInRate.value, locale)
    : null
  const repeat = rateShowable(repeatAttendance) ? formatRate(repeatAttendance.value, locale) : null
  const repeatHint =
    repeat !== null && repeatAttendance.numerator !== null && repeatAttendance.denominator !== null
      ? t("kpi.returning_hint", {
          numerator: repeatAttendance.numerator,
          denominator: repeatAttendance.denominator,
        })
      : undefined

  return (
    <SectionCard label={t("numbers.section")} trailing={rangePicker}>
      <View style={styles.root}>
        <StatTileRow columns={columns}>
          <StatTile label={t("kpi.events")} value={formatStatValue(totals.events, locale)} />
          <StatTile
            label={t("kpi.registrations")}
            value={formatStatValue(totals.registrations, locale)}
          />
          <StatTile label={t("kpi.check_ins")} value={formatStatValue(totals.checkIns, locale)} />
          <StatTile label={t("kpi.attendance_rate")} value={attendance} />
        </StatTileRow>

        <StatTileRow columns={2}>
          <StatTile
            label={t("kpi.unique_volunteers")}
            value={formatStatValue(totals.uniqueAttendees, locale)}
          />
          <StatTile label={t("kpi.returning")} value={repeat} hint={repeatHint} />
        </StatTileRow>

        {seriesChartable(chart.points) && end ? (
          <TrendSparkline
            kind="bars"
            height={TREND_HEIGHT}
            points={sparklinePoints(chart.points)}
            suppressedKeys={suppressedSparkKeys(chart.points)}
            endLabel={t(chart.weekly ? "kpi.end_label_week" : "kpi.end_label", {
              value: end.value,
              day: seriesDayLabel(end.day, locale),
            })}
            accessibilityLabel={t(chart.weekly ? "kpi.trend_a11y_week" : "kpi.trend_a11y", {
              range: t(`range.${range}`),
              value: end.value,
              day: seriesDayLabel(end.day, locale),
            })}
          />
        ) : null}

        {bestDayTime && bestDayTimeShowable(analytics) ? (
          <Text variant="caption">
            {t("kpi.busiest_slot", bestDayTimeParts(bestDayTime, locale))}
          </Text>
        ) : null}

        {portfolioSuppressed(analytics) ? (
          <Text variant="caption">{t("kpi.suppressed", { k })}</Text>
        ) : null}
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["3"],
  },
}))
