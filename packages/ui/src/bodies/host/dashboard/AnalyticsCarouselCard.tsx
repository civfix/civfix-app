import React, { useCallback, useState } from "react"
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import type { HostAnalyticsSummaryResponse } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, MIN_TOUCH_TARGET } from "../../../theme"
import { Icon, Text, iconMap } from "../../../typography"
import { IconTile, ListRow, SectionCard, SkeletonBlock, SkeletonGroup } from "../../../primitives"
import { AreaLineChart, BarChart, ProgressRing, useMeasuredWidth } from "../../../charts"
import { useHostAnalyticsSummary } from "../../../data/hooks/analytics"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { FeedNotice } from "../../FeedNotice"
import {
  SUMMARY_PANELS,
  busiestRows,
  carouselPage,
  hasSeriesData,
  checkInRingA11y,
  ratePercent,
  summaryImpactRows,
  weeklyXLabels,
  type SummaryPanelKey,
} from "../analyticsModel"
import { useWeekLabel } from "../useWeekLabel"

const HEADER_HEIGHT = 30

const CHART_HEIGHT = 132

const X_LABEL_ROW = 14

const HEAD_GAP = 8

const PANEL_HEIGHT = HEADER_HEIGHT + HEAD_GAP + CHART_HEIGHT

const RING_SIZE = 116

const RING_THICKNESS = 10

const RING_GUTTER = 12

const DOT_SIZE = 6

const DOT_TARGET = 24

const DOT_SLOP_Y = (MIN_TOUCH_TARGET - DOT_TARGET) / 2

const DOT_HIT_SLOP = { top: DOT_SLOP_Y, bottom: DOT_SLOP_Y }

const CHEVRON_HIT = 28

const FLAT_SERIES = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
]

const IS_WEB = Platform.OS === "web"

const WEB_PAGE_SCROLL_THROTTLE_MS = 100

export interface AnalyticsCarouselCardProps {
  orgId: string | null
}

export function AnalyticsCarouselCard({ orgId }: AnalyticsCarouselCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const { width, onLayout } = useMeasuredWidth()
  const [index, setIndex] = useState(0)
  const scroller = React.useRef<ScrollView>(null)

  const query = useHostAnalyticsSummary(orgId)
  const data = query.data ?? null
  const panels = SUMMARY_PANELS

  const onPageSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(carouselPage(event.nativeEvent.contentOffset.x, width, panels.length))
    },
    [panels.length, width],
  )

  // react-native-web never emits momentum events; its onScroll fires on a throttle and once more
  // when the scroll settles.
  const pageSettleProps = IS_WEB
    ? { onScroll: onPageSettled, scrollEventThrottle: WEB_PAGE_SCROLL_THROTTLE_MS }
    : { onMomentumScrollEnd: onPageSettled }

  const goTo = useCallback(
    (next: number) => {
      const clamped = carouselPage(next * width, width, panels.length)
      setIndex(clamped)
      scroller.current?.scrollTo({ x: clamped * width, animated: true })
    },
    [panels.length, width],
  )

  const openFull = useCallback(() => {
    useNavStore.getState().push({ kind: "host-analytics" })
  }, [])

  const footer = (
    <ListRow
      leading={<IconTile icon="BarChart3" />}
      title={t("card.view_full")}
      titleLines={1}
      chevron
      pressedHighlight={false}
      onPress={openFull}
    />
  )

  const heading = t("card.title")
  const window = (
    <Text variant="caption" numberOfLines={1}>
      {t("card.window")}
    </Text>
  )

  if (query.isPending) {
    return (
      <SectionCard label={heading} trailing={window} variant="list">
        <View style={styles.pad}>
          <SkeletonGroup>
            <View style={styles.skeleton}>
              <SkeletonBlock width="40%" height={HEADER_HEIGHT} />
              <SkeletonBlock width="100%" height={CHART_HEIGHT} />
            </View>
          </SkeletonGroup>
        </View>
        {footer}
      </SectionCard>
    )
  }

  if (query.isError || !data) {
    return (
      <SectionCard label={heading} trailing={window} variant="list">
        <View style={styles.pad}>
          <FeedNotice
            icon="CloudOff"
            title={t("card.error_title")}
            body={t("card.error_body")}
            actionLabel={t("card.retry")}
            onAction={() => void query.refetch()}
          />
        </View>
        {footer}
      </SectionCard>
    )
  }

  return (
    <SectionCard label={heading} trailing={window} variant="list">
      <View style={styles.pad}>
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
              {...pageSettleProps}
              accessibilityLabel={t("card.carousel_a11y")}
            >
              {panels.map((panel, position) => (
                <View
                  key={panel}
                  accessible
                  accessibilityLabel={t("card.panel_a11y", {
                    index: position + 1,
                    total: panels.length,
                    name: t(`card.panel_${panel}`),
                  })}
                  style={[{ width }, styles.panel]}
                >
                  <Panel panel={panel} data={data} width={width} />
                </View>
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
                state.pressed || webHover(state) ? styles.chevronHovered : null,
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
                state.pressed || webHover(state) ? styles.chevronHovered : null,
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
              hitSlop={DOT_HIT_SLOP}
              {...focusRingProps}
              style={styles.dotTarget}
            >
              <View style={[styles.dot, dot === index ? styles.dotOn : null]} />
            </Pressable>
          ))}
        </View>
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
  panel: SummaryPanelKey
  data: HostAnalyticsSummaryResponse
  width: number
}) {
  const th = useTheme()
  const { t } = useT("host-analytics")
  const weekLabel = useWeekLabel()

  if (panel === "signups") {
    const daily = data.signupsDaily
    return (
      <PanelFrame
        value={String(data.activity.signups)}
        caption={t("card.signups_caption", { events: data.totals.events })}
      >
        {hasSeriesData(daily) ? (
          <BarChart
            bars={daily.map((point) => ({
              key: point.day,
              value: point.suppressed ? null : point.value,
              color: th.colors.accent,
            }))}
            xLabels={weeklyXLabels(daily, weekLabel)}
            width={width}
            height={CHART_HEIGHT - X_LABEL_ROW}
            labelColor={th.colors.textSubtle}
            accessibilityLabel={t("card.signups_spark_a11y")}
          />
        ) : (
          <EmptyChart width={width} label={t("card.signups_empty")} />
        )}
      </PanelFrame>
    )
  }

  if (panel === "checkins") {
    const held = data.eventsHeld
    const ran = held.count > 0
    const rate = ran ? ratePercent(held.checkInRate) : null
    return (
      <PanelFrame
        value={String(held.checkIns)}
        caption={t("card.checkins_caption", {
          registered: held.registered,
          count: held.count,
        })}
      >
        <RingPanel
          ring={(rate ?? 0) / 100}
          ringLabel={rate === null ? EMPTY_VALUE : `${rate}%`}
          ringA11y={checkInRingA11y(t, rate)}
          note={ran ? null : t("card.checkins_empty")}
        />
      </PanelFrame>
    )
  }

  if (panel === "hours") {
    const rows = busiestRows(data.hoursByEvent.rows)
    return (
      <PanelFrame
        value={t("card.hours_value", { hours: Math.round(data.activity.hoursTotal) })}
        caption={t("card.hours_caption", { volunteers: data.activity.hoursVolunteers })}
      >
        {rows.length === 0 ? (
          <EmptyChart width={width} label={t("card.hours_empty")} />
        ) : (
          <BarChart
            bars={rows.map((row, index) => ({
              key: `${index}:${row.key}`,
              label: row.label,
              value: row.suppressed ? null : row.value,
              color: th.colors.accent,
              valueLabel: row.suppressed ? EMPTY_VALUE : String(row.value ?? 0),
            }))}
            width={width}
            horizontal
            trackColor={th.colors.chartTrack}
            labelColor={th.colors.textMuted}
            accessibilityLabel={t("card.hours_bars_a11y")}
          />
        )}
      </PanelFrame>
    )
  }

  return (
    <PanelFrame
      value={String(data.activity.reportsLinked)}
      caption={t("card.impact_caption")}
    >
      <StatRows
        rows={summaryImpactRows(data.activity).map((row) => ({
          key: row.key,
          text: t(`card.impact_${row.key}`, { n: row.value }),
        }))}
      />
    </PanelFrame>
  )
}

function PanelFrame({
  value,
  caption,
  children,
}: {
  value: string
  caption: string
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
      </View>
      <View style={styles.chart}>{children}</View>
    </View>
  )
}

function StatRows({ rows }: { rows: readonly { key: string; text: string }[] }) {
  const styles = useStyles()
  return (
    <View style={styles.statRows}>
      {rows.map((row) => (
        <Text key={row.key} variant="caption" numberOfLines={1} style={styles.statRow}>
          {row.text}
        </Text>
      ))}
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

function RingPanel({
  ring,
  ringLabel,
  ringA11y,
  note,
}: {
  ring: number
  ringLabel: string
  ringA11y: string
  note: string | null
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
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pad: {
    paddingHorizontal: t.space["5"],
  },
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
  chart: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  statRows: {
    gap: t.space["2"],
  },
  statRow: {
    color: t.colors.text,
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
  },
  dotTarget: {
    width: DOT_TARGET,
    height: DOT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: DOT_TARGET / 2,
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
}))
