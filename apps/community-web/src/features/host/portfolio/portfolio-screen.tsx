"use client"

import { Building2, CalendarDays } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import { ANALYTICS_SUPPRESSION_K } from "@civfix/shared"
import type {
  HostedEventsAnalyticsResponse,
  HostedEventsWhen,
  ListMyHostedEventsResponse,
} from "@civfix/shared"
import { useApi, useMyHostedEvents, useMyOrganizations, hostedEventRows } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useConsoleUrlState } from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { HBarRanked, KpiCell, Sparkline } from "@/components/console/charts"

import { ConsoleShell } from "../layout/console-shell"
import { OrgSwitcher } from "../layout/org-switcher"
import { useConsoleHomeNav } from "../layout/home-nav"
import { MAX_BOTTOM_TABS } from "../layout/nav-items"
import { useConsoleNavigation } from "../console-context"
import { consoleKeys } from "../console-keys"
import { useConsoleFormat, seriesDayLabel } from "../format"
import { HOSTED_WHENS, HostedEventRow, isHostedWhen, openEventCreator } from "../hosted-events"
import { AnalyticsValue, EmptyValue, SuppressionNote } from "../analytics/analytics-value"
import {
  seriesHasSuppressedPoints,
  seriesIsChartable,
  seriesValuesForChart,
} from "../analytics/suppression"

const PORTFOLIO_ANALYTICS_RANGE = "90d"
const TOP_EVENTS_SHOWN = 8
const SPARKLINE_WIDTH = 260
const SPARKLINE_HEIGHT = 56

export interface PortfolioScreenProps {
  notFoundPath: string | null
}

export function PortfolioScreen({ notFoundPath }: PortfolioScreenProps) {
  const { t } = useT("host-portfolio")
  const { t: tc } = useT("host-common")
  const { t: to } = useT("host-org")
  const api = useApi()
  const { params, set } = useConsoleUrlState()
  const { go } = useConsoleNavigation()

  const when: HostedEventsWhen = isHostedWhen(params.who) ? params.who : "upcoming"
  const orgFilter = params.status ?? null

  const orgs = useMyOrganizations()
  const events = useMyHostedEvents(when, orgFilter)
  const analytics = useQuery<HostedEventsAnalyticsResponse>({
    queryKey: consoleKeys.portfolioAnalytics(PORTFOLIO_ANALYTICS_RANGE, orgFilter ?? "all"),
    queryFn: () =>
      api.hostedEventsAnalytics({
        range: PORTFOLIO_ANALYTICS_RANGE,
        ...(orgFilter ? { orgId: orgFilter } : {}),
      }),
    retry: false,
  })

  const eventsGate = useGate(events)
  const rows = hostedEventRows(events.data?.pages)

  const navItems = useConsoleHomeNav(orgs.data, {
    portfolio: t("nav.events"),
    newOrg: to("nav.new_org", { defaultValue: "New organization" }),
  })

  const noOrgs = orgs.isSuccess && (orgs.data?.length ?? 0) === 0

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={navItems.slice(0, MAX_BOTTOM_TABS)}
      activeId="portfolio"
      title={t("title")}
      subtitle={t("subtitle")}
      headerActions={<OrgSwitcher orgId={null} />}
    >
      {notFoundPath ? (
        <div
          role="status"
          className="mb-token-4 rounded-sm border border-console-sun-strong/40 bg-console-sun-soft px-token-4 py-token-3 text-token-13 text-console-sun-strong"
        >
          {t("unknown_route", { path: notFoundPath })}
        </div>
      ) : null}

      <PortfolioKpis kpis={events.data?.pages[0]?.kpis ?? null} />

      <PortfolioTrend analytics={analytics} />

      <section aria-labelledby="portfolio-events">
        <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-3">
          <h2
            id="portfolio-events"
            className="font-display text-token-16 font-bold text-console-ink"
          >
            {t("list.title")}
          </h2>
          <div className="flex flex-wrap items-center gap-token-2">
            {(orgs.data?.length ?? 0) > 0 ? (
              <SegmentedControl
                size="sm"
                label={t("list.org_filter")}
                value={orgFilter ?? "all"}
                onChange={(value) => set({ status: value === "all" ? null : value, cursor: null })}
                options={[
                  { value: "all", label: t("list.all_orgs") },
                  ...(orgs.data ?? []).map((org) => ({ value: org.id, label: org.name })),
                ]}
              />
            ) : null}
            <SegmentedControl
              size="sm"
              label={t("list.when")}
              value={when}
              onChange={(value) => set({ who: value, cursor: null })}
              options={HOSTED_WHENS.map((value) => ({ value, label: t(`list.when_${value}`) }))}
            />
          </div>
        </div>

        <StateGate
          {...eventsGate}
          onRetry={() => void events.refetch()}
          empty={rows.length === 0}
          emptyState={
            <EmptyState
              icon={CalendarDays}
              title={t("list.empty_title")}
              body={t("list.empty_body")}
              cta={{
                label: t("list.create"),
                onPress: openEventCreator,
              }}
            />
          }
        >
          <div className="overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1">
            {rows.map((row) => (
              <HostedEventRow key={row.id} row={row} showOrg showWaitlist />
            ))}
          </div>
          {events.hasNextPage ? (
            <div className="mt-token-3 flex justify-center">
              <ConsoleButton
                variant="outline"
                size="sm"
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
              >
                {events.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
              </ConsoleButton>
            </div>
          ) : null}
        </StateGate>
      </section>

      {noOrgs ? (
        <section aria-labelledby="portfolio-orgs" className="mt-token-6">
          <h2 id="portfolio-orgs" className="sr-only">
            {to("switcher.label", { defaultValue: "Organizations" })}
          </h2>
          <EmptyState
            icon={Building2}
            tone="lilac"
            title={to("portfolio.empty_title", { defaultValue: "Host as an organization" })}
            body={to("portfolio.empty_body", {
              defaultValue:
                "An organization is a shared identity for a nonprofit, agency or community group: events carry its name and badge, and teammates co-host under it.",
            })}
            cta={{
              label: to("portfolio.empty_cta", { defaultValue: "Create an organization" }),
              onPress: () => go({ kind: "org-new" }),
            }}
          />
        </section>
      ) : null}
    </ConsoleShell>
  )
}

function PortfolioKpis({ kpis }: { kpis: ListMyHostedEventsResponse["kpis"] | null }) {
  const { t } = useT("host-portfolio")
  const format = useConsoleFormat()
  return (
    <section aria-labelledby="portfolio-kpis" className="mb-token-6">
      <h2 id="portfolio-kpis" className="sr-only">
        {t("kpis.heading")}
      </h2>
      <div className="grid grid-cols-2 gap-token-3 lg:grid-cols-4">
        <KpiCell
          label={t("kpis.events_hosted")}
          value={kpis ? format.number(kpis.eventsHosted) : <EmptyValue />}
        />
        <KpiCell
          label={t("kpis.upcoming")}
          value={kpis ? format.number(kpis.upcomingEvents) : <EmptyValue />}
        />
        <KpiCell
          label={t("kpis.registrations")}
          sub={t("kpis.this_page")}
          value={kpis ? format.number(kpis.totalRegistrations) : <EmptyValue />}
        />
        <KpiCell
          label={t("kpis.checked_in")}
          sub={t("kpis.this_page")}
          value={kpis ? format.number(kpis.totalCheckedIn) : <EmptyValue />}
        />
      </div>
    </section>
  )
}

function PortfolioTrend({ analytics }: { analytics: UseQueryResult<HostedEventsAnalyticsResponse> }) {
  const { t } = useT("host-portfolio")
  const format = useConsoleFormat()
  const analyticsGate = useGate(analytics)
  const series = analytics.data?.series ?? []
  const k = analytics.data?.k ?? ANALYTICS_SUPPRESSION_K
  const sparkValues = seriesValuesForChart(series)
  const byEvent = analytics.data?.byEvent
  return (
    <section
      aria-labelledby="portfolio-trend"
      className="mb-token-6 rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="mb-token-3 flex flex-wrap items-baseline justify-between gap-token-2">
        <h2
          id="portfolio-trend"
          className="font-display text-token-16 font-bold text-console-ink"
        >
          {t("trend.title")}
        </h2>
        <p className="text-token-12 text-console-ink-3">{t("trend.range")}</p>
      </div>
      <StateGate
        {...analyticsGate}
        onRetry={() => void analytics.refetch()}
        skeleton={<LoadingState shape="chart" count={1} />}
        empty={!seriesIsChartable(series)}
        emptyState={
          <p className="text-token-13 text-console-ink-3">{t("trend.not_enough_data")}</p>
        }
      >
        <div className="flex flex-wrap items-center gap-token-5">
          <Sparkline
            values={sparkValues}
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
            label={t("trend.a11y", {
              from: seriesDayLabel(series[0]?.day ?? "", format.locale),
              to: seriesDayLabel(series[series.length - 1]?.day ?? "", format.locale),
            })}
          />
          <dl className="flex flex-wrap gap-token-5">
            <div>
              <dt className="text-token-12 text-console-ink-3">{t("trend.registrations")}</dt>
              <dd className="text-token-16 font-bold text-console-ink">
                <AnalyticsValue value={analytics.data?.totals.registrations ?? null} k={k} />
              </dd>
            </div>
            <div>
              <dt className="text-token-12 text-console-ink-3">{t("trend.unique")}</dt>
              <dd className="text-token-16 font-bold text-console-ink">
                <AnalyticsValue value={analytics.data?.totals.uniqueAttendees ?? null} k={k} />
              </dd>
            </div>
            <div>
              <dt className="text-token-12 text-console-ink-3">{t("trend.check_in_rate")}</dt>
              <dd className="text-token-16 font-bold text-console-ink">
                <AnalyticsValue
                  value={analytics.data?.averageCheckInRate.value ?? null}
                  kind="rate"
                  k={k}
                />
              </dd>
            </div>
          </dl>
        </div>
        {seriesHasSuppressedPoints(series) ? <SuppressionNote k={k} /> : null}
        {byEvent && !byEvent.panelSuppressed && byEvent.rows.length > 0 ? (
          <div className="mt-token-4">
            <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
              {t("trend.by_event")}
            </h3>
            <HBarRanked
              summary={t("trend.by_event_a11y")}
              items={byEvent.rows
                .filter((row) => row.value !== null)
                .slice(0, TOP_EVENTS_SHOWN)
                .map((row) => ({
                  id: row.key,
                  label: row.label,
                  value: row.value ?? 0,
                  valueLabel: format.number(row.value ?? 0),
                }))}
            />
          </div>
        ) : null}
      </StateGate>
    </section>
  )
}
