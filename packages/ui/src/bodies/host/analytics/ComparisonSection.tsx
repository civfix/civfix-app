import React from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { Text } from "../../../typography"
import { SectionCard } from "../../../primitives"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { comparisonVerdict, ratePercent, wholeEventSignups } from "../analyticsModel"
import { useAnalyticsStyles } from "./analyticsStyles"

export function ComparisonSection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useAnalyticsStyles()
  const { t } = useT("host-analytics")
  const comparison = data.comparison
  if (!comparison) return null

  const hoursPerVolunteer =
    (data.kpis.hoursVolunteers ?? 0) > 0
      ? (data.kpis.hoursTotal ?? 0) / (data.kpis.hoursVolunteers as number)
      : null

  const signups = wholeEventSignups(data)

  const rows: Array<{ key: string; value: number | null; median: number | null; text: string }> = [
    {
      key: "signups",
      value: signups,
      median: comparison.medians.signups,
      text: signups === null ? EMPTY_VALUE : String(signups),
    },
    {
      key: "check_in_rate",
      value: data.rates.checkIn.value,
      median: comparison.medians.checkInRate,
      text: ratePercent(data.rates.checkIn) === null ? EMPTY_VALUE : `${ratePercent(data.rates.checkIn)}%`,
    },
    {
      key: "hours_per_volunteer",
      value: hoursPerVolunteer,
      median: comparison.medians.hoursPerVolunteer,
      text:
        hoursPerVolunteer === null
          ? EMPTY_VALUE
          : t("card.hours_value", { hours: Math.round(hoursPerVolunteer * 10) / 10 }),
    },
  ]

  return (
    <SectionCard label={t("page.comparison_section")}>
      <View style={styles.block}>
        <Text variant="caption">{t("page.comparison_caption", { events: comparison.sampleSize })}</Text>
        {rows.map((row) => (
          <View key={row.key} style={styles.comparisonRow}>
            <Text variant="caption" numberOfLines={1} style={styles.comparisonLabel}>
              {t(`page.comparison_${row.key}`)}
            </Text>
            <Text variant="label">{row.text}</Text>
            <Text variant="caption" numberOfLines={1}>
              {t(`page.verdict_${comparisonVerdict(row.value, row.median)}`)}
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  )
}
