import React, { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import type {
  AnalyticsRange,
  BreakdownRow,
  GetEventAnalyticsResponse,
  HostAnalyticsSummaryResponse,
  Panel,
  SeriesPoint,
  SuppressedRate,
} from "@civfix/shared"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
} from "../../theme"
import { Text, iconMap } from "../../typography"
import type { AnchorRect } from "../../primitives"
import {
  Meter,
  PopoverMenu,
  SecondaryButton,
  SectionCard,
  SegmentedControl,
  StatTile,
  StatTileRow,
  statTileColumns,
  usePopoverAnchor,
} from "../../primitives"
import {
  BarChart,
  ProgressRing,
  barFraction,
  chartMax,
  useMeasuredWidth,
  type ChartBar,
} from "../../charts"
import { useCleanup } from "../../data/hooks/cleanups"
import {
  cleanupHostStanding,
  hasHostCapability,
  hostedEventRows,
  useMyHostedEvents,
} from "../../data/hooks/host"
import { useAuthState } from "../../data"
import { useEventAnalytics, useHostAnalyticsSummary } from "../../data/hooks/analytics"
import { EMPTY_VALUE, useLocale, useRelativeTime, useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { HeroSkeleton, TilesSkeleton } from "./HostSkeletons"
import {
  ALL_EVENTS_RANGE_PRESETS,
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ALL_EVENTS_PRESET,
  DEFAULT_EVENT_PRESET,
  arrivalXLabels,
  byEventRowA11y,
  comparisonVerdict,
  comparisonVisible,
  eventRowTarget,
  funnelBars,
  hasSeriesData,
  presetDays,
  rangeSlice,
  pickerOptions,
  checkInRingA11y,
  ratePercent,
  weekDayLabel,
  weeklyXLabels,
  wholeEventCheckedIn,
  wholeEventSignups,
  type AnalyticsRangePreset,
} from "./analyticsModel"

const BARS_HEIGHT = 96

const RING_SIZE = 96

const MAX_BY_EVENT_ROWS = 12

function summaryRange(preset: AnalyticsRangePreset): AnalyticsRange {
  return preset === "whole_event" ? "all" : preset
}

function breakdownBars(
  rows: readonly BreakdownRow[],
  color: string,
  label?: (row: BreakdownRow) => string,
): ChartBar[] {
  return rows.map((row) => ({
    key: row.key,
    label: label ? label(row) : row.label,
    value: row.suppressed ? null : row.value,
    color,
    valueLabel: row.suppressed ? EMPTY_VALUE : String(row.value ?? 0),
  }))
}

function useWeekLabel(): (day: string) => string {
  const { locale } = useLocale()
  return useMemo(() => weekDayLabel(locale), [locale])
}

export function EventAnalyticsBody({ id }: { id: string }) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("host-analytics")
  const { relative, justNow } = useRelativeTime()

  const [picked, setPicked] = useState<string | null>(id === "" ? null : id)
  const [pickedLabel, setPickedLabel] = useState<string | null>(null)
  const [preset, setPreset] = useState<AnalyticsRangePreset | null>(null)
  const [routeId, setRouteId] = useState(id)
  if (id !== routeId) {
    setRouteId(id)
    setPicked(id === "" ? null : id)
    setPickedLabel(null)
    setPreset(null)
  }
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRect, setPickerRect] = useState<AnchorRect | null>(null)
  const { ref: pickerAnchorRef, measure: measurePicker } = usePopoverAnchor(setPickerRect)
  const { width: stackWidth, onLayout } = useMeasuredWidth()

  const all = picked === null
  const presets: readonly AnalyticsRangePreset[] = all
    ? ALL_EVENTS_RANGE_PRESETS
    : ANALYTICS_RANGE_PRESETS
  const fallback = all ? DEFAULT_ALL_EVENTS_PRESET : DEFAULT_EVENT_PRESET
  const active: AnalyticsRangePreset =
    preset !== null && presets.includes(preset) ? preset : fallback

  const upcoming = useMyHostedEvents("upcoming", null)
  const past = useMyHostedEvents("past", null)
  const options = useMemo(
    () => pickerOptions(hostedEventRows(upcoming.data?.pages), hostedEventRows(past.data?.pages)),
    [upcoming.data, past.data],
  )

  const moreEvents = upcoming.hasNextPage || past.hasNextPage
  const loadingMoreEvents = upcoming.isFetchingNextPage || past.isFetchingNextPage
  const loadMoreEvents = () => {
    if (upcoming.hasNextPage && !upcoming.isFetchingNextPage) void upcoming.fetchNextPage()
    if (past.hasNextPage && !past.isFetchingNextPage) void past.fetchNextPage()
  }

  const summary = useHostAnalyticsSummary(null, summaryRange(active), { enabled: all })
  const cleanup = useCleanup(picked ?? undefined)
  const viewerId = useAuthState().user?.id ?? null
  const canView = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "view_analytics")
  const event = useEventAnalytics(picked ?? undefined, "full", { enabled: !all && canView })

  const now = Date.now()
  const generatedAt = all ? (summary.data?.generatedAt ?? null) : (event.data?.generatedAt ?? null)
  const updatedAgo = generatedAt === null ? null : relative(generatedAt, now)

  const pickedTitle =
    picked === null
      ? null
      : (options.find((option) => option.id === picked)?.title ?? pickedLabel)

  const filters = (
    <View style={styles.filters}>
      <View ref={pickerAnchorRef} style={styles.pickerSlot}>
        <SecondaryButton
          size="sm"
          trailingIcon={iconMap.ChevronDown}
          label={pickedTitle ?? t("filter.all_events")}
          accessibilityLabel={t("filter.event_a11y", {
            name: pickedTitle ?? t("filter.all_events"),
          })}
          onPress={() => {
            measurePicker()
            setPickerOpen(true)
          }}
        />
      </View>
      <SegmentedControl
        size="sm"
        label={t("range.label")}
        selected={active}
        onSelect={(key) => setPreset(key as AnalyticsRangePreset)}
        options={presets.map((key) => ({ key, label: t(`range.${key}`) }))}
      />
    </View>
  )

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header" {...headingLevel(1)}>
        {all ? t("page.all_title") : t("page.title")}
      </Text>
      {updatedAgo === null ? null : (
        <Text variant="caption">
          {updatedAgo === justNow
            ? t("page.updated_just_now")
            : t("page.updated", { when: updatedAgo })}
        </Text>
      )}
    </View>
  )

  const picker = (
    <PopoverMenu
      visible={pickerOpen}
      anchorRect={pickerRect}
      align="left"
      onClose={() => setPickerOpen(false)}
      items={[
        {
          key: "all",
          label: t("filter.all_events"),
          ...(picked === null ? { icon: "Check" as const } : {}),
          onPress: () => {
            setPickerOpen(false)
            setPicked(null)
            setPickedLabel(null)
            setPreset(null)
          },
        },
        ...options.map((option) => ({
          key: option.id,
          label: option.title,
          ...(picked === option.id ? { icon: "Check" as const } : {}),
          onPress: () => {
            setPickerOpen(false)
            setPicked(option.id)
            setPickedLabel(option.title)
            setPreset(null)
          },
        })),
        ...(moreEvents
          ? [
              {
                key: "more",
                label: loadingMoreEvents ? t("filter.loading_more") : t("filter.more_events"),
                disabled: loadingMoreEvents,
                keepOpen: true,
                onPress: loadMoreEvents,
              },
            ]
          : []),
      ]}
    />
  )

  const frame = (content: React.ReactNode) => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack} onLayout={onLayout}>
        {header}
        {filters}
        {content}
      </View>
      {picker}
    </ScrollView>
  )

  const skeleton = (
    <View style={styles.stack}>
      <HeroSkeleton />
      <TilesSkeleton columns={2} count={6} />
    </View>
  )

  const errorState = (retry: () => void) => (
    <FeedNotice
      plain
      icon="CloudOff"
      title={t("state.error_title")}
      body={t("state.error_body")}
      actionLabel={t("card.retry")}
      onAction={retry}
    />
  )

  if (all) {
    if (summary.isPending) return frame(skeleton)
    if (summary.isError || !summary.data)
      return frame(errorState(() => void summary.refetch()))
    return frame(
      <AllEventsMode
        data={summary.data}
        width={stackWidth}
        onPickEvent={(row) => {
          const target = eventRowTarget(row, options)
          if (target === null) return
          setPicked(target.id)
          setPickedLabel(target.title)
          setPreset(null)
        }}
      />,
    )
  }

  if (cleanup.isPending) return frame(skeleton)

  if (cleanup.isError) return frame(errorState(() => void cleanup.refetch()))

  if (!canView) {
    return frame(
      <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />,
    )
  }

  if (event.isPending) return frame(skeleton)

  if (event.isError || !event.data) return frame(errorState(() => void event.refetch()))

  return frame(
    <SingleEventMode data={event.data} width={stackWidth} days={presetDays(active)} now={now} />,
  )
}

function AllEventsMode({
  data,
  width,
  onPickEvent,
}: {
  data: HostAnalyticsSummaryResponse
  width: number
  onPickEvent: (row: BreakdownRow) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const weekLabel = useWeekLabel()
  const columns = statTileColumns(width)
  const held = data.eventsHeld
  const checkIn = held.count > 0 ? ratePercent(held.checkInRate) : null
  const daily = data.signupsDaily
  const rows = data.byEvent.rows.slice(0, MAX_BY_EVENT_ROWS)

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
            bars={daily.map((point) => ({
              key: point.day,
              value: point.suppressed ? null : point.value,
              color: th.colors.accent,
            }))}
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
                max={chartMax(rows.map((each) => (each.suppressed ? null : each.value)))}
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
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const value = row.suppressed ? null : row.value
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
      <View style={styles.funnelTrack}>
        <View
          style={[
            styles.funnelFill,
            {
              width: `${Math.max(value === null ? 0 : 2, barFraction(value, max) * 100)}%`,
              backgroundColor: value === null ? th.colors.chartTrack : th.colors.accent,
            },
          ]}
        />
      </View>
    </Pressable>
  )
}

function SingleEventMode({
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
  const styles = useStyles()
  const { t } = useT("host-analytics")

  return (
    <>
      <KpiStrip data={data} width={width} />

      <SectionCard label={t("page.signups_section")}>
        <SignupsSection data={data} days={days} now={now} />
      </SectionCard>

      <SectionCard label={t("page.funnel_section")}>
        <Funnel data={data} />
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

function SignupsSection({
  data,
  days,
  now,
}: {
  data: GetEventAnalyticsResponse
  days: number | null
  now: number
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const weekLabel = useWeekLabel()
  const { width, onLayout } = useMeasuredWidth()
  const daily = rangeSlice(data.signups.daily, days, now)
  const cancellations = rangeSlice(data.signups.cancellations, days, now)
  const capacity = data.kpis.capacity
  const signups = wholeEventSignups(data) ?? 0

  return (
    <View style={styles.block} onLayout={onLayout}>
      {capacity ? (
        <View style={styles.block}>
          <Text variant="label">{t("page.capacity_line", { signups, capacity })}</Text>
          <Meter
            value={signups}
            max={capacity}
            accessibilityLabel={t("page.capacity_line", { signups, capacity })}
          />
        </View>
      ) : null}

      {hasSeriesData(daily) ? (
        <>
          <Text variant="label">{t("registration.new")}</Text>
          <BarChart
            bars={daily.map((point, index) => ({
              key: point.day,
              value: point.suppressed ? null : point.value,
              color: th.colors.accent,
              stackValue: cancellationAt(cancellations, index),
              stackColor: th.colors.dangerWash,
            }))}
            xLabels={weeklyXLabels(daily, weekLabel)}
            width={width}
            height={BARS_HEIGHT}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("registration.over_time_a11y")}
          />
        </>
      ) : (
        <Text variant="caption">{t("page.signups_empty")}</Text>
      )}
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
    <View style={styles.block} role="group" accessibilityLabel={t("funnel.a11y")}>
      {bars.map((bar) => (
        <View key={bar.step} style={styles.funnelRow}>
          <View style={styles.funnelHead}>
            <Text variant="caption" numberOfLines={1} style={styles.funnelLabel}>
              {t(`funnel.${bar.step}`)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {bar.value === null
                ? EMPTY_VALUE
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

function SourcesSection({
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

function EventDaySection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useStyles()
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
          bars={arrivals.map((point) => ({
            key: point.day,
            value: point.suppressed ? null : point.value,
            color: th.colors.accent,
          }))}
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
          bars={breakdownBars(buckets, th.colors.accent)}
          horizontal
          labelColor={th.colors.textMuted}
          accessibilityLabel={t("page.hours_distribution")}
        />
      ) : (
        <Text variant="caption">{t("page.hours_empty")}</Text>
      )}

      <Text variant="caption">
        {t("page.reports_line", {
          count: data.kpis.reportsLinked ?? 0,
          resolved: data.kpis.reportsResolved ?? 0,
        })}
      </Text>
      <Text variant="caption">
        {t("page.posts_line", { count: data.kpis.postsCreated ?? 0 })}
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

const useStyles = makeThemedStyles((t) => ({
  scroll: {
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
  filters: {
    gap: t.space["2"],
  },
  pickerSlot: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  block: {
    gap: t.space["2"],
  },
  eventRow: {
    gap: 2,
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.sm,
  },
  eventRowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  eventRowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  eventRowLabel: {
    flexShrink: 1,
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
