"use client"

import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import type {
  AnalyticsRange,
  EventAnalyticsBroadcastsResponse,
  EventAnalyticsCheckinsResponse,
  EventAnalyticsOverviewResponse,
  EventAnalyticsRegistrationsResponse,
  EventAnalyticsSourcesResponse,
  Panel,
} from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useConsoleUrlState } from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { LoadingState, StateGate } from "@/components/console/states"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { ConsoleButton } from "@/components/console/button"
import {
  Donut,
  FunnelRibbon,
  HBarRanked,
  Histogram,
  KpiCell,
  LineArea,
  StackedBars,
} from "@/components/console/charts"
import { csvFilename, downloadCsv, provenanceRows } from "@/components/console/export"
import type { CsvRow } from "@/components/console/export"

import { useConsoleEvent } from "../console-context"
import { consoleKeys } from "../console-keys"
import { EMPTY_VALUE, useConsoleFormat, seriesDayLabel } from "../format"
import { AnalyticsValue, PanelSuppressed, SuppressionNote } from "./analytics-value"
import {
  panelIsBlank,
  seriesHasSuppressedPoints,
  seriesValuesForChart as seriesValues,
  visibleRows,
} from "./suppression"

const RANGES: readonly AnalyticsRange[] = ["7d", "30d", "90d", "all"]
const TABS = ["registration", "attendance", "messaging", "page"] as const
type AnalyticsTab = (typeof TABS)[number]

function isRange(value: string | undefined): value is AnalyticsRange {
  return value !== undefined && (RANGES as readonly string[]).includes(value)
}

function isTab(value: string | undefined): value is AnalyticsTab {
  return value !== undefined && (TABS as readonly string[]).includes(value)
}

function PanelBars({
  panel,
  title,
  summary,
  k,
}: {
  panel: Panel
  title: string
  summary: string
  k: number
}) {
  const format = useConsoleFormat()
  const rows = visibleRows(panel)
  return (
    <div>
      <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
        {title}
      </h3>
      {panelIsBlank(panel) ? (
        <PanelSuppressed k={k} />
      ) : (
        <HBarRanked
          summary={summary}
          items={rows.map((row) => ({
            id: row.key,
            label: row.label,
            value: row.value ?? 0,
            valueLabel: format.number(row.value ?? 0),
          }))}
        />
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1">
      <h2 className="mb-token-3 font-display text-token-16 font-bold text-console-ink">{title}</h2>
      {children}
    </section>
  )
}

export function AnalyticsScreen() {
  const { t } = useT("host-analytics")
  const api = useApi()
  const format = useConsoleFormat()
  const { eventId, event } = useConsoleEvent()
  const { params, set } = useConsoleUrlState()

  const range: AnalyticsRange = isRange(params.range) ? params.range : "30d"
  const tab: AnalyticsTab = isTab(params.tab) ? params.tab : "registration"

  const overview = useQuery<EventAnalyticsOverviewResponse>({
    queryKey: consoleKeys.analytics(eventId, "overview", range),
    queryFn: () => api.eventAnalyticsOverview({ id: eventId, range }),
    retry: false,
  })
  const registrations = useQuery<EventAnalyticsRegistrationsResponse>({
    queryKey: consoleKeys.analytics(eventId, "registrations", range),
    enabled: tab === "registration",
    queryFn: () => api.eventAnalyticsRegistrations({ id: eventId, range }),
    retry: false,
  })
  const checkins = useQuery<EventAnalyticsCheckinsResponse>({
    queryKey: consoleKeys.analytics(eventId, "checkins", range),
    enabled: tab === "attendance",
    queryFn: () => api.eventAnalyticsCheckins({ id: eventId, range }),
    retry: false,
  })
  const broadcasts = useQuery<EventAnalyticsBroadcastsResponse>({
    queryKey: consoleKeys.analytics(eventId, "broadcasts", range),
    enabled: tab === "messaging",
    queryFn: () => api.eventAnalyticsBroadcasts({ id: eventId, range }),
    retry: false,
  })
  const sources = useQuery<EventAnalyticsSourcesResponse>({
    queryKey: consoleKeys.analytics(eventId, "sources", range),
    enabled: tab === "page",
    queryFn: () => api.eventAnalyticsSources({ id: eventId, range }),
    retry: false,
  })

  const overviewGate = useGate(overview)
  const k = overview.data?.k ?? 5
  const rangeApplies = tab !== "attendance"
  const tabQuery =
    tab === "registration"
      ? registrations
      : tab === "attendance"
        ? checkins
        : tab === "messaging"
          ? broadcasts
          : sources

  const exportCurrent = () => {
    const labels = {
      source: t("csv.source"),
      reference: t("csv.reference"),
      generatedAt: t("csv.generated_at"),
      filters: t("csv.filters"),
      none: t("csv.none"),
      suppression: t("csv.suppression_k"),
      note: t("csv.note"),
    }
    const generatedAt =
      tabQuery.data?.generatedAt ?? overview.data?.generatedAt ?? new Date().toISOString()
    const head = provenanceRows({
      title: t("csv.title", { event: event?.title ?? "", tab: t(`tab.${tab}`) }),
      reference: event?.referenceCode ?? null,
      generatedAt,
      generatedAtLabel: format.dateTime(generatedAt),
      filters: [
        {
          label: t("range.label"),
          value: rangeApplies ? t(`range.${range}`) : t("range.whole_event"),
        },
      ],
      suppressed: true,
      suppressionK: k,
      notes: [t("csv.k_note", { k })],
      labels,
    })

    let body: CsvRow[] = []
    if (tab === "registration" && registrations.data) {
      body = [
        [t("csv.day"), t("csv.registrations"), t("csv.cumulative")],
        ...registrations.data.series.map((point, index) => [
          point.day,
          point.value,
          registrations.data?.cumulative[index]?.value ?? null,
        ]),
      ]
    } else if (tab === "attendance" && checkins.data) {
      body = [
        [t("csv.minute_offset"), t("csv.arrivals")],
        ...checkins.data.arrivals.map((point) => [point.day, point.value]),
      ]
    } else if (tab === "messaging" && broadcasts.data) {
      body = [
        [t("csv.channel"), t("csv.sent"), t("csv.failed"), t("csv.suppressed")],
        ...broadcasts.data.byChannel.map((row) => [
          row.channel,
          row.sent,
          row.failed,
          row.suppressed,
        ]),
      ]
    } else if (tab === "page" && sources.data) {
      body = [
        [t("csv.day"), t("csv.page_views")],
        ...sources.data.pageViews.map((point) => [point.day, point.value]),
      ]
    }

    downloadCsv(csvFilename([event?.title ?? "event", tab], new Date()), [...head, ...body])
  }

  return (
    <div className="flex flex-col gap-token-5">
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <SegmentedControl
          label={t("tab.label")}
          value={tab}
          onChange={(value) => set({ tab: value })}
          options={TABS.map((value) => ({ value, label: t(`tab.${value}`) }))}
        />
        <div className="flex items-center gap-token-2">
          {rangeApplies ? (
            <SegmentedControl
              size="sm"
              label={t("range.label")}
              value={range}
              onChange={(value) => set({ range: value })}
              options={RANGES.map((value) => ({ value, label: t(`range.${value}`) }))}
            />
          ) : (
            <p className="text-token-12 text-console-ink-3">{t("range.whole_event")}</p>
          )}
          <ConsoleButton
            variant="outline"
            size="sm"
            disabled={!tabQuery.data}
            onClick={exportCurrent}
          >
            {t("export_csv")}
          </ConsoleButton>
        </div>
      </div>

      <StateGate
        {...overviewGate}
        onRetry={() => void overview.refetch()}
        skeleton={<LoadingState shape="kpi" count={2} />}
      >
        {overview.data ? (
          <>
            <div className="grid grid-cols-2 gap-token-3 lg:grid-cols-4">
              <KpiCell
                label={t("kpi.registered")}
                value={<AnalyticsValue value={overview.data.kpis.registered} k={k} />}
              />
              <KpiCell
                label={t("kpi.checked_in")}
                value={<AnalyticsValue value={overview.data.kpis.checkedIn} k={k} />}
              />
              <KpiCell
                label={t("kpi.check_in_rate")}
                value={
                  <AnalyticsValue value={overview.data.checkInRate.value} kind="rate" k={k} />
                }
              />
              <KpiCell
                label={t("kpi.page_views")}
                value={<AnalyticsValue value={overview.data.kpis.pageViews} k={k} />}
              />
            </div>
            {overview.data.funnel.length > 0 ? (
              <FunnelRibbon
                summary={t("funnel.a11y")}
                stages={overview.data.funnel.map((step, index) => ({
                  id: step.step,
                  label: step.label,
                  value: step.value === null ? EMPTY_VALUE : format.number(step.value),
                  tone: index === 0 ? "sky" : index === overview.data!.funnel.length - 1 ? "moss" : "neutral",
                }))}
              />
            ) : null}
            <SuppressionNote k={k} />
          </>
        ) : null}
      </StateGate>

      {tab === "registration" ? (
        <RegistrationTab query={registrations} k={k} />
      ) : tab === "attendance" ? (
        <AttendanceTab query={checkins} k={k} />
      ) : tab === "messaging" ? (
        <MessagingTab query={broadcasts} k={k} />
      ) : (
        <PageTab query={sources} k={k} />
      )}
    </div>
  )
}

function RegistrationTab({
  query,
  k,
}: {
  query: UseQueryResult<EventAnalyticsRegistrationsResponse>
  k: number
}) {
  const { t } = useT("host-analytics")
  const format = useConsoleFormat()
  const gate = useGate(query)
  const data = query.data
  return (
    <StateGate {...gate} onRetry={() => void query.refetch()} skeleton={<LoadingState shape="chart" count={2} />}>
      {data ? (
        <div className="flex flex-col gap-token-4">
          <Card title={t("registration.over_time")}>
            <LineArea
              area
              suppressedLabel={t("suppressed.point")}
              summary={t("registration.over_time_a11y")}
              labels={data.series.map((point) => seriesDayLabel(point.day, format.locale))}
              series={[
                { id: "new", label: t("registration.new"), values: seriesValues(data.series) },
                {
                  id: "cumulative",
                  label: t("registration.cumulative"),
                  values: seriesValues(data.cumulative),
                },
              ]}
            />
            {seriesHasSuppressedPoints(data.series) ? <SuppressionNote k={k} /> : null}
          </Card>
          <Card title={t("registration.cancellations")}>
            <StackedBars
              suppressedLabel={t("suppressed.point")}
              summary={t("registration.cancellations_a11y")}
              labels={data.cancellations.map((point) => seriesDayLabel(point.day, format.locale))}
              series={[
                {
                  id: "cancelled",
                  label: t("registration.cancelled"),
                  values: seriesValues(data.cancellations),
                },
              ]}
            />
          </Card>
          <Card title={t("registration.breakdowns")}>
            <div className="grid gap-token-4 lg:grid-cols-2">
              <PanelBars
                panel={data.byTicketType}
                title={t("registration.by_ticket_type")}
                summary={t("registration.by_ticket_type")}
                k={k}
              />
              <PanelBars
                panel={data.byAudience}
                title={t("registration.by_audience")}
                summary={t("registration.by_audience")}
                k={k}
              />
            </div>
          </Card>
        </div>
      ) : null}
    </StateGate>
  )
}

function AttendanceTab({
  query,
  k,
}: {
  query: UseQueryResult<EventAnalyticsCheckinsResponse>
  k: number
}) {
  const { t } = useT("host-analytics")
  const gate = useGate(query)
  const data = query.data
  return (
    <StateGate {...gate} onRetry={() => void query.refetch()} skeleton={<LoadingState shape="chart" count={2} />}>
      {data ? (
        <div className="flex flex-col gap-token-4">
          <Card title={t("attendance.arrivals")}>
            <p className="mb-token-2 text-token-12 text-console-ink-3">
              {t("attendance.arrivals_hint")}
            </p>
            <Histogram
              summary={t("attendance.arrivals_a11y")}
              valueLabel={t("attendance.arrivals_value")}
              bins={data.arrivals
                .filter((point) => point.value !== null)
                .map((point) => ({
                  label: t("attendance.minute", { minutes: point.day }),
                  count: point.value as number,
                }))}
            />
            {seriesHasSuppressedPoints(data.arrivals) ? <SuppressionNote k={k} /> : null}
          </Card>
          <Card title={t("attendance.rates")}>
            <dl className="grid grid-cols-2 gap-token-4">
              <div>
                <dt className="text-token-12 text-console-ink-3">{t("attendance.check_in_rate")}</dt>
                <dd className="text-token-20 font-bold text-console-ink">
                  <AnalyticsValue value={data.checkInRate.value} kind="rate" k={k} />
                </dd>
              </div>
              <div>
                <dt className="text-token-12 text-console-ink-3">{t("attendance.no_show_rate")}</dt>
                <dd className="text-token-20 font-bold text-console-ink">
                  <AnalyticsValue value={data.noShowRate.value} kind="rate" k={k} />
                </dd>
              </div>
            </dl>
          </Card>
          <Card title={t("attendance.breakdowns")}>
            <div className="grid gap-token-4 lg:grid-cols-2">
              <PanelBars
                panel={data.byTicketType}
                title={t("attendance.by_ticket_type")}
                summary={t("attendance.by_ticket_type")}
                k={k}
              />
              <PanelBars
                panel={data.bySlot}
                title={t("attendance.by_slot")}
                summary={t("attendance.by_slot")}
                k={k}
              />
            </div>
          </Card>
        </div>
      ) : null}
    </StateGate>
  )
}

function MessagingTab({
  query,
  k,
}: {
  query: UseQueryResult<EventAnalyticsBroadcastsResponse>
  k: number
}) {
  const { t } = useT("host-analytics")
  const { t: te } = useT("enums")
  const format = useConsoleFormat()
  const gate = useGate(query)
  const data = query.data
  return (
    <StateGate {...gate} onRetry={() => void query.refetch()} skeleton={<LoadingState shape="chart" count={2} />}>
      {data ? (
        <div className="flex flex-col gap-token-4">
          <Card title={t("messaging.totals")}>
            <dl className="grid grid-cols-3 gap-token-4">
              <div>
                <dt className="text-token-12 text-console-ink-3">
                  {t("messaging.broadcasts_sent")}
                </dt>
                <dd className="text-token-20 font-bold text-console-ink">
                  <AnalyticsValue value={data.broadcastsSent} k={k} />
                </dd>
              </div>
              <div>
                <dt className="text-token-12 text-console-ink-3">{t("messaging.recipients")}</dt>
                <dd className="text-token-20 font-bold text-console-ink">
                  <AnalyticsValue value={data.recipients} k={k} />
                </dd>
              </div>
              <div>
                <dt className="text-token-12 text-console-ink-3">{t("messaging.unsubscribes")}</dt>
                <dd className="text-token-20 font-bold text-console-ink">
                  <AnalyticsValue value={data.unsubscribes} k={k} />
                </dd>
              </div>
            </dl>
            <p className="mt-token-2 text-token-12 text-console-ink-3">
              {t("messaging.no_tracking")}
            </p>
          </Card>
          <Card title={t("messaging.by_channel")}>
            <StackedBars
              suppressedLabel={t("suppressed.point")}
              summary={t("messaging.by_channel_a11y")}
              labels={data.byChannel.map((row) => te(`broadcastChannel.${row.channel}`))}
              series={[
                {
                  id: "sent",
                  label: t("messaging.sent"),
                  values: data.byChannel.map((row) => row.sent),
                },
                {
                  id: "failed",
                  label: t("messaging.failed"),
                  values: data.byChannel.map((row) => row.failed),
                },
                {
                  id: "suppressed",
                  label: t("messaging.suppressed"),
                  values: data.byChannel.map((row) => row.suppressed),
                },
              ]}
            />
          </Card>
          <Card title={t("messaging.over_time")}>
            <LineArea
              suppressedLabel={t("suppressed.point")}
              summary={t("messaging.over_time_a11y")}
              labels={data.series.map((point) => seriesDayLabel(point.day, format.locale))}
              series={[
                { id: "sends", label: t("messaging.sends"), values: seriesValues(data.series) },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </StateGate>
  )
}

function PageTab({
  query,
  k,
}: {
  query: UseQueryResult<EventAnalyticsSourcesResponse>
  k: number
}) {
  const { t } = useT("host-analytics")
  const format = useConsoleFormat()
  const gate = useGate(query)
  const data = query.data
  return (
    <StateGate {...gate} onRetry={() => void query.refetch()} skeleton={<LoadingState shape="chart" count={2} />}>
      {data ? (
        <div className="flex flex-col gap-token-4">
          <Card title={t("page.views")}>
            <LineArea
              area
              suppressedLabel={t("suppressed.point")}
              summary={t("page.views_a11y")}
              labels={data.pageViews.map((point) => seriesDayLabel(point.day, format.locale))}
              series={[
                { id: "views", label: t("page.views"), values: seriesValues(data.pageViews) },
              ]}
            />
          </Card>
          <Card title={t("page.by_source")}>
            <PanelBars
              panel={data.bySource}
              title={t("page.by_source")}
              summary={t("page.by_source")}
              k={k}
            />
          </Card>
          <Card title={t("page.donation_clicks")}>
            <Donut
              summary={t("page.donation_clicks")}
              size={120}
              centerValue={
                data.donationClicks === null ? EMPTY_VALUE : format.number(data.donationClicks)
              }
              centerLabel={t("page.donation_clicks")}
              segments={
                data.donationClicks === null
                  ? []
                  : [
                      {
                        id: "clicks",
                        label: t("page.donation_clicks"),
                        value: data.donationClicks,
                      },
                    ]
              }
            />
          </Card>
        </div>
      ) : null}
    </StateGate>
  )
}
