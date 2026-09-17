import React, { useCallback, useMemo, useState } from "react"
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover } from "../../../theme"
import { Icon, Text, iconMap } from "../../../typography"
import { IconTile, ListRow, SectionCard, SkeletonBlock, SkeletonGroup } from "../../../primitives"
import { AreaLineChart, BarChart, ProgressRing, useMeasuredWidth } from "../../../charts"
import { useEventAnalytics } from "../../../data/hooks/analytics"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { FeedNotice } from "../../FeedNotice"
import {
  busiestRows,
  carouselPage,
  hasSeriesData,
  isArchivalEvent,
  latestPoints,
  ratePercent,
  reachRateVisible,
  seriesPoints,
  visibleAnalyticsPanels,
  type AnalyticsPanelKey,
} from "../analyticsModel"

const HEADER_HEIGHT = 30

const CHART_HEIGHT = 132

const HEAD_GAP = 8

const PANEL_HEIGHT = HEADER_HEIGHT + HEAD_GAP + CHART_HEIGHT

const RING_SIZE = 116

const RING_THICKNESS = 10

const RING_GUTTER = 12

const DOT_SIZE = 6

const CHEVRON_HIT = 28

const FLAT_SERIES = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
]

const DASH = "—"

const IS_WEB = Platform.OS === "web"

export interface AnalyticsCarouselCardProps {
  cleanupId: string
  enabled?: boolean
  label?: string
}

export function AnalyticsCarouselCard({
  cleanupId,
  enabled = true,
  label,
}: AnalyticsCarouselCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { width, onLayout } = useMeasuredWidth()
  const [index, setIndex] = useState(0)
  const scroller = React.useRef<ScrollView>(null)

  const heading = label ?? t("card.title")

  const query = useEventAnalytics(cleanupId, "card", { enabled })
  const data = query.data ?? null
  const panels = useMemo<readonly AnalyticsPanelKey[]>(
    () => (data ? visibleAnalyticsPanels(data) : []),
    [data],
  )
  const active = panels[Math.min(index, Math.max(0, panels.length - 1))] ?? null

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(carouselPage(event.nativeEvent.contentOffset.x, width, panels.length))
    },
    [panels.length, width],
  )

  const goTo = useCallback(
    (next: number) => {
      const clamped = carouselPage(next * width, width, panels.length)
      setIndex(clamped)
      scroller.current?.scrollTo({ x: clamped * width, animated: true })
    },
    [panels.length, width],
  )

  const openFull = useCallback(() => {
    useNavStore.getState().push({ kind: "event-analytics", id: cleanupId })
  }, [cleanupId])

  const footer = (
    <ListRow
      leading={<IconTile icon="BarChart3" />}
      title={t("card.view_full")}
      titleLines={1}
      chevron
      onPress={openFull}
    />
  )

  if (query.isPending) {
    return (
      <SectionCard label={heading}>
        <SkeletonGroup>
          <View style={styles.skeleton}>
            <SkeletonBlock width="40%" height={HEADER_HEIGHT} />
            <SkeletonBlock width="100%" height={CHART_HEIGHT} />
          </View>
        </SkeletonGroup>
        {footer}
      </SectionCard>
    )
  }

  if (query.isError || !data) {
    return (
      <SectionCard label={heading}>
        <FeedNotice
          icon="CloudOff"
          title={t("card.error_title")}
          body={t("card.error_body")}
          actionLabel={t("card.retry")}
          onAction={() => void query.refetch()}
        />
        {footer}
      </SectionCard>
    )
  }

  if (isArchivalEvent(data.lifecycle, data.phase, Date.now())) {
    return (
      <SectionCard label={heading} trailing={<Text variant="caption">{t("card.final")}</Text>}>
        <Text style={styles.archival}>
          {t("card.archival_summary", {
            hours: Math.round(data.kpis.hoursTotal ?? 0),
            volunteers: data.kpis.hoursVolunteers ?? 0,
            attended: data.kpis.checkedIn ?? 0,
          })}
        </Text>
        {footer}
      </SectionCard>
    )
  }

  return (
    <SectionCard
      label={heading}
      trailing={
        active ? (
          <Text variant="caption" numberOfLines={1}>
            {t(`card.caption_${active}`)}
          </Text>
        ) : undefined
      }
    >
      <View style={styles.viewport} onLayout={onLayout}>
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            snapToInterval={width}
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            accessibilityLabel={t("card.carousel_a11y")}
          >
            {panels.map((panel) => (
              <Pressable
                key={panel}
                onPress={openFull}
                accessibilityRole="button"
                accessibilityLabel={t("card.panel_a11y", {
                  index: panels.indexOf(panel) + 1,
                  total: panels.length,
                  name: t(`card.panel_${panel}`),
                })}
                {...focusRingProps}
                style={(state) => [
                  { width },
                  styles.panel,
                  webCursor(),
                  webHover(state) ? styles.panelHovered : null,
                ]}
              >
                <Panel panel={panel} data={data} width={width} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {IS_WEB && width > 0 && index > 0 ? (
          <Pressable
            onPress={() => goTo(index - 1)}
            accessibilityRole="button"
            accessibilityLabel={t("card.previous_a11y")}
            {...focusRingProps}
            style={(state) => [
              styles.chevron,
              styles.chevronLeft,
              webCursor(),
              webHover(state) ? styles.chevronHovered : null,
            ]}
          >
            <Icon icon={iconMap.ChevronLeft} size={16} color={th.colors.textMuted} />
          </Pressable>
        ) : null}
        {IS_WEB && width > 0 && index < panels.length - 1 ? (
          <Pressable
            onPress={() => goTo(index + 1)}
            accessibilityRole="button"
            accessibilityLabel={t("card.next_a11y")}
            {...focusRingProps}
            style={(state) => [
              styles.chevron,
              styles.chevronRight,
              webCursor(),
              webHover(state) ? styles.chevronHovered : null,
            ]}
          >
            <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.dots}>
        {panels.map((panel, dot) => (
          <Pressable
            key={panel}
            onPress={() => goTo(dot)}
            accessibilityRole="button"
            accessibilityState={{ selected: dot === index }}
            accessibilityLabel={t("card.panel_a11y", {
              index: dot + 1,
              total: panels.length,
              name: t(`card.panel_${panel}`),
            })}
            hitSlop={8}
            {...focusRingProps}
            style={[styles.dot, dot === index ? styles.dotOn : null]}
          />
        ))}
      </View>

      {footer}
    </SectionCard>
  )
}

function Panel({
  panel,
  data,
  width,
}: {
  panel: AnalyticsPanelKey
  data: GetEventAnalyticsResponse
  width: number
}) {
  const th = useTheme()
  const { t } = useT("host-analytics")

  if (panel === "signups") {
    const delta = data.deltas.signups7d ?? 0
    return (
      <PanelFrame
        value={String(data.kpis.signups ?? 0)}
        caption={
          data.kpis.capacity
            ? t("card.signups_of", { capacity: data.kpis.capacity })
            : t("card.signups_caption")
        }
        pill={delta > 0 ? t("card.signups_delta", { delta }) : undefined}
      >
        {hasSeriesData(data.signups.cumulative) ? (
          <AreaLineChart
            series={seriesPoints(data.signups.cumulative)}
            width={width}
            height={CHART_HEIGHT}
            stroke={th.colors.accent}
            fill={th.colors.selectedFill}
            {...(data.kpis.capacity
              ? { refLineY: data.kpis.capacity, refLineColor: th.colors.chartInkMuted }
              : {})}
            gridColor={th.colors.border}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("card.signups_spark_a11y")}
          />
        ) : (
          <EmptyChart width={width} label={t("card.signups_empty")} />
        )}
      </PanelFrame>
    )
  }

  if (panel === "reach") {
    const rate = ratePercent(data.rates.viewToSignup)
    return (
      <PanelFrame
        value={String(data.kpis.pageViews ?? 0)}
        caption={t("card.reach_caption")}
        pill={
          reachRateVisible(data.kpis.pageViews, data.rates.viewToSignup) && rate !== null
            ? t("card.reach_rate", { rate })
            : undefined
        }
      >
        {hasSeriesData(data.reach.viewsDaily) ? (
          <AreaLineChart
            series={seriesPoints(data.reach.viewsDaily)}
            width={width}
            height={CHART_HEIGHT}
            stroke={th.colors.chartInkMuted}
            fill={th.colors.chartTrack}
            gridColor={th.colors.border}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("card.reach_spark_a11y")}
          />
        ) : (
          <EmptyChart width={width} label={t("card.reach_empty")} />
        )}
      </PanelFrame>
    )
  }

  if (panel === "slots") {
    const fill = ratePercent(data.rates.fill)
    const rows = busiestRows(data.signups.bySlot?.rows ?? [])
    return (
      <PanelFrame
        value={fill === null ? DASH : `${fill}%`}
        caption={t("card.slots_caption")}
      >
        {rows.length === 0 ? (
          <EmptyChart width={width} label={t("card.slots_empty")} />
        ) : (
          <BarChart
            bars={rows.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.suppressed ? null : row.value,
              color: th.colors.accent,
              valueLabel: row.suppressed ? DASH : String(row.value ?? 0),
            }))}
            width={width}
            horizontal
            trackColor={th.colors.chartTrack}
            labelColor={th.colors.textMuted}
            accessibilityLabel={t("card.slots_bars_a11y")}
          />
        )}
      </PanelFrame>
    )
  }

  if (panel === "checkins") {
    const upcoming = data.phase === "upcoming"
    const rate = upcoming ? null : ratePercent(data.rates.checkIn)
    const arrivals = upcoming ? [] : latestPoints(data.eventDay.arrivals)
    const showBars = !upcoming && hasSeriesData(arrivals)
    const barsWidth = Math.max(0, width - RING_SIZE - RING_GUTTER)
    return (
      <PanelFrame
        value={String(upcoming ? (data.kpis.signups ?? 0) : (data.kpis.checkedIn ?? 0))}
        caption={
          upcoming
            ? t("card.checkins_pre")
            : t("card.checkins_of", { signups: data.kpis.signups ?? 0, rate: rate ?? 0 })
        }
        pill={
          !upcoming && data.kpis.noShow
            ? t("card.checkins_no_shows", { noShow: data.kpis.noShow })
            : undefined
        }
      >
        <CheckinsChart
          ring={(rate ?? 0) / 100}
          ringLabel={rate === null ? DASH : `${rate}%`}
          ringA11y={t("card.checkins_ring_a11y", { rate: rate ?? 0 })}
          note={
            showBars
              ? null
              : upcoming
                ? t("card.checkins_pre_visual")
                : t("card.checkins_empty")
          }
        >
          {showBars ? (
            <BarChart
              bars={arrivals.map((point) => ({
                key: point.day,
                value: point.suppressed ? null : point.value,
                color: th.colors.accent,
              }))}
              width={barsWidth}
              height={CHART_HEIGHT}
              labelColor={th.colors.textMuted}
              accessibilityLabel={t("card.checkins_bars_a11y")}
            />
          ) : null}
        </CheckinsChart>
      </PanelFrame>
    )
  }

  if (data.phase === "upcoming") {
    return (
      <PanelFrame
        value={String(data.kpis.reportsLinked ?? 0)}
        caption={t("card.impact_pre")}
      >
        <EmptyChart width={width} label={t("card.impact_pre_visual")} />
      </PanelFrame>
    )
  }

  const cells = [
    { key: "volunteers", value: data.kpis.hoursVolunteers ?? 0 },
    { key: "reports_linked", value: data.kpis.reportsLinked ?? 0 },
    { key: "reports_resolved", value: data.kpis.reportsResolved ?? 0 },
    { key: "donations", value: data.kpis.donationClicks ?? 0 },
  ]
  return (
    <PanelFrame
      value={t("card.hours_value", { hours: Math.round(data.kpis.hoursTotal ?? 0) })}
      caption={t("card.impact_caption")}
    >
      <BarChart
        bars={cells.map((cell) => ({
          key: cell.key,
          label: t(`card.impact_${cell.key}`),
          value: cell.value,
          color: th.colors.accent,
          valueLabel: String(cell.value),
        }))}
        width={width}
        horizontal
        trackColor={th.colors.chartTrack}
        labelColor={th.colors.textMuted}
        accessibilityLabel={t("card.impact_bars_a11y")}
      />
    </PanelFrame>
  )
}

function PanelFrame({
  value,
  caption,
  pill,
  children,
}: {
  value: string
  caption: string
  pill?: string
  children: React.ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.frame}>
      <View style={styles.head}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text variant="caption" numberOfLines={1} style={styles.caption}>
          {caption}
        </Text>
        {pill ? (
          <View style={styles.pill}>
            <Text style={styles.pillText} numberOfLines={1}>
              {pill}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chart}>{children}</View>
    </View>
  )
}

function EmptyChart({ width, label }: { width: number; label: string }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.emptyChart}>
      <AreaLineChart
        series={FLAT_SERIES}
        width={width}
        height={CHART_HEIGHT}
        stroke={th.colors.chartTrack}
        gridColor={th.colors.border}
        labelColor={th.colors.textSubtle}
        accessibilityLabel={label}
      />
      <View style={styles.emptyLabel} pointerEvents="none">
        <Text variant="caption" numberOfLines={2} style={styles.emptyText}>
          {label}
        </Text>
      </View>
    </View>
  )
}

function CheckinsChart({
  ring,
  ringLabel,
  ringA11y,
  note,
  children,
}: {
  ring: number
  ringLabel: string
  ringA11y: string
  note: string | null
  children: React.ReactNode
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.checkins}>
      <ProgressRing
        value={ring}
        size={RING_SIZE}
        thickness={RING_THICKNESS}
        color={th.colors.accent}
        trackColor={th.colors.chartTrack}
        accessibilityLabel={ringA11y}
      >
        <Text style={styles.ringValue}>{ringLabel}</Text>
      </ProgressRing>
      <View style={styles.checkinsSide}>
        {note ? (
          <Text variant="caption" numberOfLines={3} style={styles.emptyText}>
            {note}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  skeleton: {
    gap: t.space["2"],
    height: PANEL_HEIGHT,
    justifyContent: "center",
  },
  viewport: {
    height: PANEL_HEIGHT,
  },
  panel: {
    height: PANEL_HEIGHT,
    overflow: "hidden",
    borderRadius: t.radius.md,
  },
  panelHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  frame: {
    height: PANEL_HEIGHT,
    justifyContent: "flex-start",
    gap: HEAD_GAP,
  },
  head: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  value: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  caption: {
    flexShrink: 1,
    minWidth: 0,
  },
  pill: {
    flexShrink: 0,
    paddingHorizontal: t.space["2"],
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.selectedFill,
  },
  pillText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  chart: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: "center",
  },
  emptyLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["4"],
  },
  emptyText: {
    color: t.colors.textSubtle,
    textAlign: "center",
  },
  checkins: {
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: RING_GUTTER,
  },
  checkinsSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  ringValue: {
    fontFamily: t.fontFamily.displaySemiBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    paddingVertical: t.space["2"],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: t.colors.chartTrack,
  },
  dotOn: {
    backgroundColor: t.colors.accent,
  },
  chevron: {
    position: "absolute",
    top: PANEL_HEIGHT / 2 - CHEVRON_HIT / 2,
    width: CHEVRON_HIT,
    height: CHEVRON_HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CHEVRON_HIT / 2,
    backgroundColor: t.colors.surface,
  },
  chevronHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  chevronLeft: {
    left: 0,
  },
  chevronRight: {
    right: 0,
  },
  archival: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
}))
