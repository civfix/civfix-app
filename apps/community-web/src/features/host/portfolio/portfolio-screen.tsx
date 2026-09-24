"use client"

import { useMemo } from "react"
import { Building2, CalendarDays, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import type { HostedEventsAnalyticsResponse, HostedEventsWhen } from "@civfix/shared"
import { useApi, useMyHostedEvents, useMyOrganizations, hostedEventRows } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { hrefForRoute } from "@/components/console/route"
import { useConsoleUrlState } from "@/components/console/url-state"
import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, LoadingState, StateGate } from "@/components/console/states"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"
import { HBarRanked, KpiCell, Sparkline } from "@/components/console/charts"

import { ConsoleShell } from "../layout/console-shell"
import { OrgSwitcher } from "../layout/org-switcher"
import type { ConsoleNavItem } from "../layout/nav-items"
import { useConsoleNavigation } from "../console-context"
import { consoleKeys } from "../console-keys"
import { useConsoleFormat, seriesDayLabel } from "../format"
import { AnalyticsValue, EmptyValue, SuppressionNote } from "../analytics/analytics-value"
import {
  DEFAULT_SUPPRESSION_K,
  seriesHasSuppressedPoints,
  seriesIsChartable,
  seriesValuesForChart,
} from "../analytics/suppression"

const WHENS: readonly HostedEventsWhen[] = ["upcoming", "past", "all"]

function isWhen(value: string | undefined): value is HostedEventsWhen {
  return value === "upcoming" || value === "past" || value === "all"
}

export interface PortfolioScreenProps {
  notFoundPath: string | null
}

export function PortfolioScreen({ notFoundPath }: PortfolioScreenProps) {
  const { t } = useT("host-portfolio")
  const { t: tc } = useT("host-common")
  const { t: to } = useT("host-org")
  const format = useConsoleFormat()
  const api = useApi()
  const { params, set } = useConsoleUrlState()
  const { go } = useConsoleNavigation()

  const when: HostedEventsWhen = isWhen(params.who) ? params.who : "upcoming"
  const orgFilter = params.status ?? null

  const orgs = useMyOrganizations()
  const events = useMyHostedEvents(when, orgFilter)
  const analytics = useQuery<HostedEventsAnalyticsResponse>({
    queryKey: consoleKeys.portfolioAnalytics("90d", orgFilter ?? "all"),
    queryFn: () => api.hostedEventsAnalytics({ range: "90d", ...(orgFilter ? { orgId: orgFilter } : {}) }),
    retry: false,
  })

  const eventsGate = useGate(events)
  const analyticsGate = useGate(analytics)
  const rows = hostedEventRows(events.data?.pages)
  const kpis = events.data?.pages[0]?.kpis ?? null

  const navItems = useMemo<ConsoleNavItem[]>(() => {
    const items: ConsoleNavItem[] = [
      {
        id: "portfolio",
        label: t("nav.events"),
        icon: CalendarDays,
        href: hrefForRoute({ kind: "portfolio" }),
      },
    ]
    for (const org of orgs.data ?? []) {
      items.push({
        id: `org:${org.id}`,
        label: org.name,
        icon: Building2,
        href: hrefForRoute({ kind: "org", orgId: org.id, section: "overview" }),
      })
    }
    items.push({
      id: "org-new",
      label: to("nav.new_org", { defaultValue: "New organization" }),
      icon: Plus,
      href: hrefForRoute({ kind: "org-new" }),
    })
    return items
  }, [orgs.data, t, to])

  const noOrgs = orgs.isSuccess && (orgs.data?.length ?? 0) === 0

  const series = analytics.data?.series ?? []
  const k = analytics.data?.k ?? DEFAULT_SUPPRESSION_K
  const sparkValues = seriesValuesForChart(series)
  const byEvent = analytics.data?.byEvent

  return (
    <ConsoleShell
      navItems={navItems}
      bottomTabs={navItems.slice(0, 5)}
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
              width={260}
              height={56}
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
                  .slice(0, 8)
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
              options={WHENS.map((value) => ({ value, label: t(`list.when_${value}`) }))}
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
                onPress: () => window.location.assign("/events/"),
              }}
            />
          }
        >
          <div className="overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1">
            {rows.map((row) => (
              <QRow
                key={row.id}
                title={row.title}
                pressLabel={t("list.open", { title: row.title })}
                ident={row.referenceCode ?? undefined}
                sub={
                  <span className="flex flex-wrap items-center gap-token-2">
                    <span>{format.whenLabel(row.startsAt, row.timezone ?? undefined)}</span>
                    {row.orgName ? <span>{row.orgName}</span> : null}
                    <span>
                      {t("list.counts", {
                        registered: format.number(row.registeredCount),
                        checked: format.number(row.checkedInCount),
                      })}
                    </span>
                    {row.waitlistCount > 0 ? (
                      <span>{t("list.waitlist", { count: row.waitlistCount })}</span>
                    ) : null}
                  </span>
                }
                chips={
                  <>
                    <Chip kind="event-status" value={row.status} size="sm" />
                    <Chip kind="event-visibility" value={row.visibility} size="sm" />
                  </>
                }
                onPress={() => go({ kind: "event", eventId: row.id, section: "overview" })}
              />
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
