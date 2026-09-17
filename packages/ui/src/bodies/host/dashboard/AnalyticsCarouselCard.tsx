import React, { useCallback, useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover } from "../../../theme"
import { Icon, Text, iconMap } from "../../../typography"
import { IconTile, ListRow, SectionCard, SkeletonBlock, SkeletonGroup } from "../../../primitives"
import { BarChart, ProgressRing, Sparkline } from "../../../charts"
import { useEventAnalytics } from "../../../data/hooks/analytics"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { FeedNotice } from "../../FeedNotice"
import {
  hasSeriesData,
  isArchivalEvent,
  ratePercent,
  reachRateVisible,
  seriesValues,
  visibleAnalyticsPanels,
  type AnalyticsPanelKey,
} from "../analyticsModel"

const PANEL_HEIGHT = 148

const VISUAL_FRACTION = 0.42

const SPARK_HEIGHT = 44

const RING_SIZE = 64

const DOT_SIZE = 6

const CHEVRON_HIT = 28

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
  const [width, setWidth] = useState(0)
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

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }, [])

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return
      setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
    },
    [width],
  )

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(panels.length - 1, next))
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
            <SkeletonBlock width="40%" height={32} />
            <SkeletonBlock width="100%" height={SPARK_HEIGHT} />
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
          <Text variant="caption" numberOfLines={1} accessibilityLiveRegion="polite">
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
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
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
                  { width, height: PANEL_HEIGHT },
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

        {IS_WEB && index > 0 ? (
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
        {IS_WEB && index < panels.length - 1 ? (
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
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-analytics")
  const visualWidth = Math.max(0, Math.round(width * VISUAL_FRACTION) - 16)

  if (panel === "signups") {
    const values = seriesValues(data.signups.cumulative)
    const delta = data.deltas.signups7d ?? 0
    return (
      <PanelFrame
        hero={String(data.kpis.signups ?? 0)}
        caption={
          data.kpis.capacity
            ? t("card.signups_of", { capacity: data.kpis.capacity })
            : t("card.signups_caption")
        }
        secondary={delta > 0 ? t("card.signups_delta", { delta }) : undefined}
        visual={
          hasSeriesData(data.signups.cumulative) ? (
            <Sparkline
              points={values}
              width={visualWidth}
              height={SPARK_HEIGHT}
              stroke={th.colors.accent}
              fill={th.colors.selectedFill}
              accessibilityLabel={t("card.signups_spark_a11y")}
            />
          ) : (
            <Text variant="caption" style={styles.empty}>
              {t("card.signups_empty")}
            </Text>
          )
        }
      />
    )
  }

  if (panel === "reach") {
    const rate = ratePercent(data.rates.viewToSignup)
    return (
      <PanelFrame
        hero={String(data.kpis.pageViews ?? 0)}
        caption={t("card.reach_caption")}
        secondary={
          reachRateVisible(data.kpis.pageViews, data.rates.viewToSignup) && rate !== null
            ? t("card.reach_rate", { rate })
            : undefined
        }
        visual={
          hasSeriesData(data.reach.viewsDaily) ? (
            <Sparkline
              points={seriesValues(data.reach.viewsDaily)}
              width={visualWidth}
              height={SPARK_HEIGHT}
              stroke={th.colors.chartInkMuted}
              accessibilityLabel={t("card.reach_spark_a11y")}
            />
          ) : (
            <Text variant="caption" style={styles.empty}>
              {t("card.reach_empty")}
            </Text>
          )
        }
      />
    )
  }

  if (panel === "slots") {
    const fill = ratePercent(data.rates.fill)
    const rows = data.signups.bySlot?.rows ?? []
    return (
      <View style={styles.slotsPanel}>
        <ProgressRing
          value={(fill ?? 0) / 100}
          size={RING_SIZE}
          color={th.colors.accent}
          trackColor={th.colors.chartTrack}
          accessibilityLabel={t("card.slots_ring_a11y", { rate: fill ?? 0 })}
        >
          <Text style={styles.ringValue}>{fill === null ? "—" : `${fill}%`}</Text>
        </ProgressRing>
        <View style={styles.slotsBars}>
          {rows.length === 0 ? (
            <Text variant="caption" style={styles.empty}>
              {t("card.slots_empty")}
            </Text>
          ) : (
            <BarChart
              bars={rows.map((row) => ({
                key: row.key,
                label: row.label,
                value: row.suppressed ? null : row.value,
                color: th.colors.accent,
              }))}
              width={visualWidth}
              height={SPARK_HEIGHT}
              horizontal
              labelColor={th.colors.textMuted}
              accessibilityLabel={t("card.slots_bars_a11y")}
            />
          )}
        </View>
      </View>
    )
  }

  if (panel === "checkins") {
    if (data.phase === "upcoming") {
      return (
        <PanelFrame
          hero={String(data.kpis.signups ?? 0)}
          caption={t("card.checkins_pre")}
          visual={
            <Text variant="caption" style={styles.empty}>
              {t("card.checkins_pre_visual")}
            </Text>
          }
        />
      )
    }
    const rate = ratePercent(data.rates.checkIn)
    return (
      <PanelFrame
        hero={String(data.kpis.checkedIn ?? 0)}
        caption={t("card.checkins_of", {
          signups: data.kpis.signups ?? 0,
          rate: rate ?? 0,
        })}
        secondary={
          data.kpis.noShow ? t("card.checkins_no_shows", { noShow: data.kpis.noShow }) : undefined
        }
        visual={
          hasSeriesData(data.eventDay.arrivals) ? (
            <BarChart
              bars={data.eventDay.arrivals.map((point) => ({
                key: point.day,
                value: point.suppressed ? null : point.value,
                color: th.colors.accent,
              }))}
              width={visualWidth}
              height={SPARK_HEIGHT}
              labelColor={th.colors.textMuted}
              accessibilityLabel={t("card.checkins_bars_a11y")}
            />
          ) : (
            <Text variant="caption" style={styles.empty}>
              {t("card.checkins_empty")}
            </Text>
          )
        }
      />
    )
  }

  if (data.phase === "upcoming") {
    return (
      <PanelFrame
        hero={String(data.kpis.reportsLinked ?? 0)}
        caption={t("card.impact_pre")}
        visual={
          <Text variant="caption" style={styles.empty}>
            {t("card.impact_pre_visual")}
          </Text>
        }
      />
    )
  }

  const cells: Array<{ key: string; value: number }> = [
    { key: "volunteers", value: data.kpis.hoursVolunteers ?? 0 },
    { key: "reports_linked", value: data.kpis.reportsLinked ?? 0 },
    { key: "reports_resolved", value: data.kpis.reportsResolved ?? 0 },
    { key: "donations", value: data.kpis.donationClicks ?? 0 },
  ]
  return (
    <PanelFrame
      hero={t("card.hours_value", { hours: Math.round(data.kpis.hoursTotal ?? 0) })}
      caption={t("card.impact_caption")}
      visual={
        <View style={styles.grid}>
          {cells.map((cell) => (
            <View key={cell.key} style={styles.gridCell}>
              <Text style={[styles.gridValue, cell.value === 0 ? styles.gridDim : null]}>
                {cell.value}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {t(`card.impact_${cell.key}`)}
              </Text>
            </View>
          ))}
        </View>
      }
    />
  )
}

function PanelFrame({
  hero,
  caption,
  secondary,
  visual,
}: {
  hero: string
  caption: string
  secondary?: string
  visual: React.ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.frame}>
      <View style={styles.frameText}>
        <Text style={styles.hero} numberOfLines={1}>
          {hero}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {caption}
        </Text>
        {secondary ? (
          <View style={styles.pill}>
            <Text style={styles.pillText} numberOfLines={1}>
              {secondary}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.frameVisual}>{visual}</View>
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
    justifyContent: "center",
    borderRadius: t.radius.md,
  },
  panelHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  frame: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  frameText: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  frameVisual: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  hero: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["30"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  pill: {
    alignSelf: "flex-start",
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
  empty: {
    color: t.colors.textSubtle,
    textAlign: "right",
  },
  slotsPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["4"],
  },
  slotsBars: {
    flex: 1,
    minWidth: 0,
  },
  ringValue: {
    fontFamily: t.fontFamily.displaySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    maxWidth: 160,
  },
  gridCell: {
    minWidth: 68,
  },
  gridValue: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
    fontVariant: ["tabular-nums"],
  },
  gridDim: {
    color: t.colors.textSubtle,
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
