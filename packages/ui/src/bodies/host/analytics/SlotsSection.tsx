import React from "react"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { SectionCard } from "../../../primitives"
import { BarChart } from "../../../charts"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { ratePercent } from "../analyticsModel"
import { breakdownBars } from "./chartBars"

export function SlotsSection({ data }: { data: GetEventAnalyticsResponse }) {
  const th = useTheme()
  const { t } = useT("host-analytics")
  const rows = data.signups.bySlot?.rows ?? []
  const waitlist = ratePercent(data.rates.waitlistConversion)
  if (rows.length === 0 && !data.kpis.capacity) return null

  return (
    <SectionCard label={t("page.slots_section")}>
      {rows.length > 0 ? (
        <BarChart
          bars={breakdownBars(rows, th.colors.accent)}
          horizontal
          labelColor={th.colors.textMuted}
          accessibilityLabel={t("page.slots_section")}
        />
      ) : (
        <Text variant="caption">{t("page.slots_none")}</Text>
      )}
      {data.kpis.waitlisted ? (
        <Text variant="caption">
          {t("page.waitlist_line", {
            joined: data.kpis.waitlisted,
            rate: waitlist === null ? EMPTY_VALUE : `${waitlist}%`,
          })}
        </Text>
      ) : null}
    </SectionCard>
  )
}
