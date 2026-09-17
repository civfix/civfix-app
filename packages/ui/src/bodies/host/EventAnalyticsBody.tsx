import React, { useState } from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse, Panel, SeriesPoint } from "@civfix/shared"
import { headingLevel, makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import {
  SectionCard,
  SegmentedControl,
  StatTile,
  StatTileRow,
  statTileColumns,
} from "../../primitives"
import { AreaLineChart, BarChart, ProgressRing, useMeasuredWidth } from "../../charts"
import { useCleanup } from "../../data/hooks/cleanups"
import { hasHostCapability } from "../../data/hooks/host"
import { useEventAnalytics } from "../../data/hooks/analytics"
import { useRelativeTime, useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { HeroSkeleton, TilesSkeleton } from "./HostSkeletons"
import {
  LIFECYCLE_SEGMENTS,
  comparisonVerdict,
  comparisonVisible,
  defaultSegment,
  funnelBars,
  hasSeriesData,
  ratePercent,
  segmentEnabled,
  segmentRange,
  seriesPoints,
  sliceSeries,
  type LifecycleSegment,
} from "./analyticsModel"

const CHART_HEIGHT = 140

const BARS_HEIGHT = 96

const RING_SIZE = 96

const DASH = "—"

export function EventAnalyticsBody({ id }: { id: string }) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("host-analytics")
  const { relative } = useRelativeTime()

  const cleanup = useCleanup(id)
  const canView = hasHostCapability(cleanup.data, "view_analytics")
  const query = useEventAnalytics(id, "full", { enabled: canView })

  const [segment, setSegment] = useState<LifecycleSegment | null>(null)
  const { width: stackWidth, onLayout } = useMeasuredWidth()

  const data = query.data ?? null
  const now = Date.now()
  const active: LifecycleSegment =
    segment ?? (data ? defaultSegment(data.phase, data.lifecycle, now) : "all")
  const range = data ? segmentRange(active, data.lifecycle, now) : null

  const skeleton = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <HeroSkeleton />
      <TilesSkeleton columns={2} count={6} />
    </ScrollView>
  )

  const errorState = (
    <View style={styles.fill}>
      <FeedNotice
        plain
        icon="CloudOff"
        title={t("state.error_title")}
        body={t("state.error_body")}
        actionLabel={t("card.retry")}
        onAction={() => {
          void cleanup.refetch()
          void query.refetch()
        }}
      />
    </View>
  )

  if (cleanup.isPending) return skeleton

  if (cleanup.isError) return errorState

  if (!canView) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
      </View>
    )
  }

  if (query.isPending) return skeleton

  if (query.isError || !data || !range) return errorState

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack} onLayout={onLayout}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header" {...headingLevel(1)}>
            {t("page.title")}
          </Text>
          <Text variant="caption">
            {t("page.updated", { when: relative(data.generatedAt, now) })}
          </Text>
        </View>

        <SegmentedControl
          label={t("scrubber.label")}
          selected={active}
          onSelect={(key) => setSegment(key as LifecycleSegment)}
          options={LIFECYCLE_SEGMENTS.map((key) => ({
            key,
            label: t(`scrubber.${key}`),
            disabled: !segmentEnabled(key, data.lifecycle, now),
          }))}
        />

        <KpiStrip data={data} width={stackWidth} />

        <SectionCard label={t("page.signups_section")}>
          <SignupsSection data={data} range={range} showMarker={active === "all"} />
        </SectionCard>

        <SectionCard label={t("page.funnel_section")}>
          <Funnel data={data} />
        </SectionCard>

        <SourcesSection panel={data.signups.bySource} />

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
      </View>
    </ScrollView>
  )
}

function KpiStrip({ data, width }: { data: GetEventAnalyticsResponse; width: number }) {
  const { t } = useT("host-analytics")
  const columns = statTileColumns(width)
  const checkIn = ratePercent(data.rates.checkIn)
  const fill = ratePercent(data.rates.fill)
  const pre = data.phase === "upcoming"

  return (
    <StatTileRow columns={columns}>
      <StatTile
        label={t("kpi.signups")}
        value={String(data.kpis.signups ?? 0)}
        {...(data.kpis.capacity ? { hint: t("kpi.of_capacity", { capacity: data.kpis.capacity }) } : {})}
      />
      <StatTile label={t("kpi.page_views")} value={String(data.kpis.pageViews ?? 0)} />
      <StatTile
        label={t("kpi.check_in_rate")}
        value={pre || checkIn === null ? null : `${checkIn}%`}
        hint={
          pre
            ? t("kpi.after_event_day")
            : checkIn === null
              ? t("kpi.not_enough")
              : t("kpi.checked_in_of", {
                  checkedIn: data.kpis.checkedIn ?? 0,
                  signups: data.kpis.signups ?? 0,
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
      <StatTile label={t("kpi.donation_clicks")} value={String(data.kpis.donationClicks ?? 0)} />
    </StatTileRow>
  )
}

function SignupsSection({
  data,
  range,
  showMarker,
}: {
  data: GetEventAnalyticsResponse
  range: { from: number; to: number }
  showMarker: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { width, onLayout } = useMeasuredWidth()
  const cumulative = sliceSeries(data.signups.cumulative, range)
  const daily = sliceSeries(data.signups.daily, range)
  const cancellations = sliceSeries(data.signups.cancellations, range)
  const startAt = Date.parse(data.lifecycle.startAt ?? "")

  if (!hasSeriesData(cumulative) && !hasSeriesData(daily)) {
    return <Text variant="caption">{t("page.signups_empty")}</Text>
  }

  return (
    <View style={styles.block} onLayout={onLayout}>
      <Text variant="label">{t("registration.cumulative")}</Text>
      <AreaLineChart
        series={seriesPoints(cumulative)}
        width={width}
        height={CHART_HEIGHT}
        stroke={th.colors.accent}
        fill={th.colors.selectedFill}
        {...(data.kpis.capacity
          ? { refLineY: data.kpis.capacity, refLineColor: th.colors.chartInkMuted }
          : {})}
        {...(showMarker && Number.isFinite(startAt)
          ? { markerX: startAt, markerColor: th.colors.chartInkMuted }
          : {})}
        gridColor={th.colors.border}
        labelColor={th.colors.textSubtle}
        accessibilityLabel={t("registration.over_time_a11y")}
      />

      <Text variant="label">{t("registration.new")}</Text>
      <BarChart
        bars={daily.map((point, index) => ({
          key: point.day,
          value: point.suppressed ? null : point.value,
          color: th.colors.accent,
          stackValue: cancellationAt(cancellations, index),
          stackColor: th.colors.dangerWash,
        }))}
        width={width}
        height={BARS_HEIGHT}
        labelColor={th.colors.textSubtle}
        accessibilityLabel={t("registration.over_time_a11y")}
      />
    </View>
  )
}

function cancellationAt(points: readonly SeriesPoint[], index: number): number | undefined {
  const point = points[index]
  if (!point || point.suppressed || !point.value) return undefined
  return point.value
}

function Funnel({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const bars = funnelBars(data.reach.funnel)

  if (bars.length === 0) return <Text variant="caption">{t("page.funnel_empty")}</Text>

  return (
    <View style={styles.block} accessibilityLabel={t("funnel.a11y")}>
      {bars.map((bar) => (
        <View key={bar.step} style={styles.funnelRow}>
          <View style={styles.funnelHead}>
            <Text variant="caption" numberOfLines={1} style={styles.funnelLabel}>
              {t(`funnel.${bar.step}`, { defaultValue: bar.step })}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {bar.value === null
                ? DASH
                : bar.ofPrevious === null
                  ? String(bar.value)
                  : t("funnel.of_previous", { value: bar.value, rate: bar.ofPrevious })}
            </Text>
          </View>
          <View style={styles.funnelTrack}>
            <View
              style={[
                styles.funnelFill,
                {
                  width: `${Math.max(bar.ghost ? 0 : 2, bar.fraction * 100)}%`,
                  backgroundColor: bar.ghost ? th.colors.chartTrack : th.colors.accent,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  )
}

function SourcesSection({ panel }: { panel: Panel | undefined }) {
  const th = useTheme()
  const { t } = useT("host-analytics")
  const rows = panel?.rows ?? []
  if (panel?.panelSuppressed || rows.length === 0) return null
  return (
    <SectionCard label={t("page.sources_section")}>
      <BarChart
        bars={rows.map((row) => ({
          key: row.key,
          label: row.label,
          value: row.suppressed ? null : row.value,
          color: th.colors.accent,
          valueLabel: row.suppressed ? DASH : String(row.value ?? 0),
        }))}
        horizontal
        labelColor={th.colors.textMuted}
        accessibilityLabel={t("page.sources_section")}
      />
    </SectionCard>
  )
}

function SlotsSection({ data }: { data: GetEventAnalyticsResponse }) {
  const th = useTheme()
  const { t } = useT("host-analytics")
  const rows = data.signups.bySlot?.rows ?? []
  const waitlist = ratePercent(data.rates.waitlistConversion)
  if (rows.length === 0 && !data.kpis.capacity) return null

  return (
    <SectionCard label={t("page.slots_section")}>
      {rows.length > 0 ? (
        <BarChart
          bars={rows.map((row) => ({
            key: row.key,
            label: row.label,
            value: row.suppressed ? null : row.value,
            color: th.colors.accent,
            valueLabel: row.suppressed ? DASH : String(row.value ?? 0),
          }))}
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
            rate: waitlist === null ? DASH : `${waitlist}%`,
          })}
        </Text>
      ) : null}
    </SectionCard>
  )
}

function EventDaySection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { width, onLayout } = useMeasuredWidth()
  const rate = ratePercent(data.rates.checkIn)

  if (data.phase === "upcoming") {
    return <Text variant="caption">{t("page.event_day_pre")}</Text>
  }

  return (
    <View style={styles.block} onLayout={onLayout}>
      {hasSeriesData(data.eventDay.arrivals) ? (
        <BarChart
          bars={data.eventDay.arrivals.map((point) => ({
            key: point.day,
            value: point.suppressed ? null : point.value,
            color: th.colors.accent,
          }))}
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
          accessibilityLabel={t("attendance.check_in_rate")}
        >
          <Text style={styles.ringValue}>{rate === null ? DASH : `${rate}%`}</Text>
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

function ImpactSection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const buckets = data.impact.hoursBuckets?.rows ?? []

  return (
    <View style={styles.block}>
      <Text variant="label">
        {t("page.hours_total", { hours: Math.round(data.kpis.hoursTotal ?? 0) })}
      </Text>
      {buckets.length > 0 ? (
        <BarChart
          bars={buckets.map((row) => ({
            key: row.key,
            label: row.label,
            value: row.suppressed ? null : row.value,
            color: th.colors.accent,
            valueLabel: row.suppressed ? DASH : String(row.value ?? 0),
          }))}
          horizontal
          labelColor={th.colors.textMuted}
          accessibilityLabel={t("page.hours_distribution")}
        />
      ) : (
        <Text variant="caption">{t("page.hours_empty")}</Text>
      )}

      <Text variant="caption">
        {t("page.reports_line", {
          linked: data.kpis.reportsLinked ?? 0,
          resolved: data.kpis.reportsResolved ?? 0,
        })}
      </Text>
      <Text variant="caption">
        {t("page.posts_line", { posts: data.kpis.postsCreated ?? 0 })}
      </Text>
      {data.kpis.donationClicks ? (
        <Text variant="caption">
          {t("page.donations_line", { clicks: data.kpis.donationClicks })}
        </Text>
      ) : null}
    </View>
  )
}

function ComparisonSection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useStyles()
  const { t } = useT("host-analytics")
  const comparison = data.comparison
  if (!comparison) return null

  const hoursPerVolunteer =
    (data.kpis.hoursVolunteers ?? 0) > 0
      ? (data.kpis.hoursTotal ?? 0) / (data.kpis.hoursVolunteers as number)
      : null

  const rows: Array<{ key: string; value: number | null; median: number | null; text: string }> = [
    {
      key: "signups",
      value: data.kpis.signups,
      median: comparison.medians.signups,
      text: String(data.kpis.signups ?? 0),
    },
    {
      key: "check_in_rate",
      value: data.rates.checkIn.value,
      median: comparison.medians.checkInRate,
      text: ratePercent(data.rates.checkIn) === null ? DASH : `${ratePercent(data.rates.checkIn)}%`,
    },
    {
      key: "hours_per_volunteer",
      value: hoursPerVolunteer,
      median: comparison.medians.hoursPerVolunteer,
      text:
        hoursPerVolunteer === null
          ? DASH
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

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stack: {
    gap: t.space["6"],
  },
  header: {
    gap: t.space["1"],
  },
  block: {
    gap: t.space["2"],
  },
  funnelRow: {
    gap: 2,
  },
  funnelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  funnelLabel: {
    flexShrink: 1,
  },
  funnelTrack: {
    height: 10,
    width: "100%",
    borderRadius: t.radius.sm,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  funnelFill: {
    height: "100%",
    borderRadius: t.radius.sm,
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["4"],
  },
  ringMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ringValue: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["18"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  comparisonLabel: {
    flex: 1,
    minWidth: 0,
  },
  privacy: {
    marginTop: t.space["2"],
  },
}))
