import React from "react"
import type { Panel, SuppressedRate } from "@civfix/shared"
import { useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { SectionCard } from "../../../primitives"
import { BarChart } from "../../../charts"
import { useT } from "../../../i18n"
import { ratePercent } from "../analyticsModel"
import { breakdownBars } from "./chartBars"

export function SourcesSection({
  panel,
  pageViews,
  rate,
}: {
  panel: Panel | undefined
  pageViews: number | null
  rate: SuppressedRate
}) {
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { t: tEnums } = useT("enums")
  const rows = panel?.rows ?? []
  const views = pageViews ?? 0
  const percent = ratePercent(rate)
  if (panel?.panelSuppressed || rows.length === 0) return null
  return (
    <SectionCard label={t("page.sources_section")}>
      <BarChart
        bars={breakdownBars(rows, th.colors.accent, (row) =>
          tEnums(`registrationSource.${row.key}`),
        )}
        horizontal
        labelColor={th.colors.textMuted}
        accessibilityLabel={t("page.sources_section")}
      />
      {views > 0 && percent !== null ? (
        <Text variant="caption">{t("page.sources_caption", { rate: percent, views })}</Text>
      ) : null}
    </SectionCard>
  )
}
