import React from "react"
import { Pressable, View } from "react-native"
import { MAX_HOST_SUMMARY_EVENT_ROWS, type BreakdownRow, type HostAnalyticsSummaryResponse } from "@civfix/shared"
import { visibleValue } from "@civfix/shared/host"
import { focusRingProps, useTheme, webCursor, webHover } from "../../../theme"
import { Text } from "../../../typography"
import { SectionCard, StatTile, StatTileRow, statTileColumns } from "../../../primitives"
import { BarChart, barFraction, chartMax } from "../../../charts"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { byEventRowA11y, hasSeriesData, ratePercent, weeklyXLabels } from "../analyticsModel"
import { useWeekLabel } from "../useWeekLabel"
import { BARS_HEIGHT, useAnalyticsStyles } from "./analyticsStyles"
import { seriesBars } from "./chartBars"
import { FractionBar } from "./FractionBar"

export function AllEventsMode({
  data,
  width,
  onPickEvent,
}: {
  data: HostAnalyticsSummaryResponse
  width: number
  onPickEvent: (row: BreakdownRow) => void
}) {
  const styles = useAnalyticsStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const weekLabel = useWeekLabel()
  const columns = statTileColumns(width)
  const held = data.eventsHeld
  const checkIn = held.count > 0 ? ratePercent(held.checkInRate) : null
  const daily = data.signupsDaily
  const rows = data.byEvent.rows.slice(0, MAX_HOST_SUMMARY_EVENT_ROWS)
  const rowMax = chartMax(rows.map(visibleValue))

  return (
    <>
      <StatTileRow columns={columns}>
        <StatTile label={t("kpi.signups")} value={String(data.activity.signups)} />
        <StatTile
          label={t("kpi.check_in_rate")}
          value={checkIn === null ? null : `${checkIn}%`}
          hint={t("kpi.checked_in_held", {
            checkIns: held.checkIns,
            registered: held.registered,
            count: held.count,
          })}
        />
        <StatTile
          label={t("kpi.hours")}
          value={t("card.hours_value", { hours: Math.round(data.activity.hoursTotal) })}
          hint={t("kpi.hours_people", { people: data.activity.hoursVolunteers })}
        />
        <StatTile label={t("kpi.events_held")} value={String(held.count)} />
        <StatTile label={t("kpi.reports_linked")} value={String(data.activity.reportsLinked)} />
        {data.activity.donationClicks > 0 ? (
          <StatTile
            label={t("kpi.donation_clicks")}
            value={String(data.activity.donationClicks)}
          />
        ) : null}
      </StatTileRow>

      <SectionCard label={t("page.signups_over_time")}>
        {hasSeriesData(daily) ? (
          <BarChart
            bars={seriesBars(daily, th.colors.accent)}
            xLabels={weeklyXLabels(daily, weekLabel)}
            width={width}
            height={BARS_HEIGHT}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("page.signups_over_time")}
          />
        ) : (
          <Text variant="caption">{t("page.signups_empty")}</Text>
        )}
      </SectionCard>

      <SectionCard label={t("page.by_event_section")}>
        {rows.length === 0 ? (
          <Text variant="caption">{t("page.by_event_empty")}</Text>
        ) : (
          <View style={styles.block}>
            {rows.map((row, index) => (
              <EventBarRow
                key={`${index}:${row.key}`}
                row={row}
                max={rowMax}
                onPress={() => onPickEvent(row)}
              />
            ))}
          </View>
        )}
      </SectionCard>

      <Text variant="caption" style={styles.privacy}>
        {t("suppressed.note", { k: data.k })}
      </Text>
    </>
  )
}

function EventBarRow({
  row,
  max,
  onPress,
}: {
  row: BreakdownRow
  max: number
  onPress: () => void
}) {
  const styles = useAnalyticsStyles()
  const { t } = useT("host-analytics")
  const value = visibleValue(row)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={byEventRowA11y(t, row.label, value)}
      {...focusRingProps}
      style={(state) => [
        styles.eventRow,
        webCursor(),
        state.pressed || webHover(state) ? styles.eventRowHovered : null,
      ]}
    >
      <View style={styles.eventRowHead}>
        <Text variant="caption" numberOfLines={1} style={styles.eventRowLabel}>
          {row.label}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {value === null ? EMPTY_VALUE : String(value)}
        </Text>
      </View>
      <FractionBar fraction={barFraction(value, max)} ghost={value === null} />
    </Pressable>
  )
}
