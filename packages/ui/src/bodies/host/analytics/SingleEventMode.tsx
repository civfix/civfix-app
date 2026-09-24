import React from "react"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { Text } from "../../../typography"
import { SectionCard, StatTile, StatTileRow, statTileColumns } from "../../../primitives"
import { useT } from "../../../i18n"
import {
  comparisonVisible,
  ratePercent,
  wholeEventCheckedIn,
  wholeEventSignups,
} from "../analyticsModel"
import { useAnalyticsStyles } from "./analyticsStyles"
import { ComparisonSection } from "./ComparisonSection"
import { EventDaySection } from "./EventDaySection"
import { FunnelSection } from "./FunnelSection"
import { ImpactSection } from "./ImpactSection"
import { SignupsSection } from "./SignupsSection"
import { SlotsSection } from "./SlotsSection"
import { SourcesSection } from "./SourcesSection"

export function SingleEventMode({
  data,
  width,
  days,
  now,
}: {
  data: GetEventAnalyticsResponse
  width: number
  days: number | null
  now: number
}) {
  const styles = useAnalyticsStyles()
  const { t } = useT("host-analytics")

  return (
    <>
      <KpiStrip data={data} width={width} />

      <SectionCard label={t("page.signups_section")}>
        <SignupsSection data={data} days={days} now={now} />
      </SectionCard>

      <SectionCard label={t("page.funnel_section")}>
        <FunnelSection data={data} />
      </SectionCard>

      <SourcesSection panel={data.signups.bySource} pageViews={data.kpis.pageViews} rate={data.rates.viewToSignup} />

      <SlotsSection data={data} />

      <SectionCard label={t("page.event_day_section")}>
        <EventDaySection data={data} />
      </SectionCard>

      <SectionCard label={t("page.impact_section")}>
        <ImpactSection data={data} />
      </SectionCard>

      {comparisonVisible(data) ? <ComparisonSection data={data} /> : null}

      <Text variant="caption" style={styles.privacy}>
        {t("suppressed.note", { k: data.k })}
      </Text>
    </>
  )
}

function KpiStrip({ data, width }: { data: GetEventAnalyticsResponse; width: number }) {
  const { t } = useT("host-analytics")
  const columns = statTileColumns(width)
  const checkIn = ratePercent(data.rates.checkIn)
  const fill = ratePercent(data.rates.fill)
  const pre = data.phase === "upcoming"
  const views = data.kpis.pageViews ?? 0
  const donations = data.kpis.donationClicks ?? 0
  const signups = wholeEventSignups(data)

  return (
    <StatTileRow columns={columns}>
      <StatTile
        label={t("kpi.signups")}
        value={signups === null ? null : String(signups)}
        hint={signups === null ? t("kpi.not_enough") : t("range.whole_event")}
      />
      {views > 0 ? (
        <StatTile label={t("kpi.page_views")} value={String(views)} />
      ) : null}
      <StatTile
        label={t("kpi.check_in_rate")}
        value={pre || checkIn === null ? null : `${checkIn}%`}
        hint={
          pre
            ? t("kpi.after_event_day")
            : checkIn === null
              ? t("kpi.not_enough")
              : t("kpi.checked_in_of", {
                  checkedIn: wholeEventCheckedIn(data) ?? 0,
                  signups: signups ?? 0,
                })
        }
      />
      <StatTile
        label={t("kpi.fill_rate")}
        value={fill === null ? null : `${fill}%`}
        {...(fill === null ? { hint: t("kpi.not_enough") } : {})}
      />
      <StatTile
        label={t("kpi.hours")}
        value={t("card.hours_value", { hours: Math.round(data.kpis.hoursTotal ?? 0) })}
        hint={t("kpi.hours_people", { people: data.kpis.hoursVolunteers ?? 0 })}
      />
      {donations > 0 ? (
        <StatTile label={t("kpi.donation_clicks")} value={String(donations)} />
      ) : null}
    </StatTileRow>
  )
}
