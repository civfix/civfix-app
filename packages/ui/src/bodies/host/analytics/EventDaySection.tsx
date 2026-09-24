import React from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { BarChart, ProgressRing, useMeasuredWidth } from "../../../charts"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { arrivalXLabels, checkInRingA11y, hasSeriesData, ratePercent } from "../analyticsModel"
import { BARS_HEIGHT, useAnalyticsStyles } from "./analyticsStyles"
import { seriesBars } from "./chartBars"

const RING_SIZE = 96

export function EventDaySection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useAnalyticsStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { width, onLayout } = useMeasuredWidth()
  const rate = ratePercent(data.rates.checkIn)
  const arrivals = data.eventDay.arrivals

  if (data.phase === "upcoming") {
    return <Text variant="caption">{t("page.event_day_pre")}</Text>
  }

  return (
    <View style={styles.block} onLayout={onLayout}>
      {hasSeriesData(arrivals) ? (
        <BarChart
          bars={seriesBars(arrivals, th.colors.accent)}
          xLabels={arrivalXLabels(arrivals, (minutes) =>
            minutes === 0
              ? t("attendance.offset_start")
              : minutes < 0
                ? t("attendance.offset_before", { hours: Math.abs(minutes) / 60 })
                : t("attendance.offset_after", { hours: minutes / 60 }),
          )}
          width={width}
          height={BARS_HEIGHT}
          labelColor={th.colors.textSubtle}
          accessibilityLabel={t("attendance.arrivals_a11y")}
        />
      ) : (
        <Text variant="caption">{t("page.arrivals_empty")}</Text>
      )}

      <View style={styles.ringRow}>
        <ProgressRing
          value={(rate ?? 0) / 100}
          size={RING_SIZE}
          color={th.colors.accent}
          trackColor={th.colors.chartTrack}
          accessibilityLabel={checkInRingA11y(t, rate)}
        >
          <Text style={styles.ringValue}>{rate === null ? EMPTY_VALUE : `${rate}%`}</Text>
        </ProgressRing>
        <View style={styles.ringMeta}>
          <Text variant="caption">
            {t("page.checked_in_count", { checkedIn: data.kpis.checkedIn ?? 0 })}
          </Text>
          <Text variant="caption">
            {t("page.no_show_count", { noShow: data.kpis.noShow ?? 0 })}
          </Text>
          <Text variant="caption">
            {t("page.walkup_count", { walkUps: data.kpis.walkUps ?? 0 })}
          </Text>
        </View>
      </View>
    </View>
  )
}
