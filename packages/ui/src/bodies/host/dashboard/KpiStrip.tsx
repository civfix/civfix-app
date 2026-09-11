import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { HostedEventsAnalyticsResponse } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  webCursor,
  webHover,
  webTransition,
} from "../../../theme"
import { Text } from "../../../typography"
import { SkeletonGroup, SkeletonText } from "../../../primitives"
import { useLocale, useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { Sparkline } from "./Sparkline"
import { DASHBOARD_RANGES, seriesChartable, suppressed, type DashboardRange } from "./dashboardModel"

function formatCount(value: number | null | undefined, locale: string, dash: string): string {
  if (suppressed(value)) return dash
  try {
    return new Intl.NumberFormat(locale).format(value as number)
  } catch {
    return String(value)
  }
}

function KpiCell({ label, value, hint }: { label: string; value: string; hint: string | null }) {
  const styles = useStyles()
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue} accessibilityLabel={hint ?? undefined}>
        {value}
      </Text>
      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  )
}

export interface KpiStripProps {
  analytics: HostedEventsAnalyticsResponse | undefined
  isPending: boolean
  isError: boolean
  range: DashboardRange
  onRange: (range: DashboardRange) => void
  onRetry: () => void
}

export function KpiStrip({
  analytics,
  isPending,
  isError,
  range,
  onRange,
  onRetry,
}: KpiStripProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()

  const k = analytics?.k ?? 5
  const dash = t("kpi.hidden_value")
  const hint = t("kpi.suppressed", { k })

  const chips = (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t("range.label")}>
      {DASHBOARD_RANGES.map((option) => {
        const selected = option === range
        return (
          <Pressable
            key={option}
            onPress={() => onRange(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`range.${option}`)}
            {...focusRingProps}
            style={(state) => [
              styles.chip,
              webTransition,
              webCursor(),
              selected ? styles.chipOn : null,
              !selected && webHover(state) ? styles.chipHovered : null,
            ]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>
              {t(`range.${option}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )

  if (isError) {
    return (
      <View style={styles.section}>
        {chips}
        <FeedNotice
          icon="CloudOff"
          title={t("kpi.error_title")}
          body={t("kpi.error_body")}
          actionLabel={t("kpi.retry")}
          onAction={onRetry}
        />
      </View>
    )
  }

  if (isPending || !analytics) {
    return (
      <View style={styles.section}>
        {chips}
        <SkeletonGroup>
          <View style={styles.grid}>
            <SkeletonText width="28%" height={34} />
            <SkeletonText width="28%" height={34} />
            <SkeletonText width="28%" height={34} />
          </View>
        </SkeletonGroup>
      </View>
    )
  }

  const anySuppressed =
    suppressed(analytics.totals.events) ||
    suppressed(analytics.totals.registrations) ||
    suppressed(analytics.totals.checkIns)

  return (
    <View style={styles.section}>
      {chips}
      <View style={styles.card}>
        <View style={styles.grid}>
          <KpiCell
            label={t("kpi.events")}
            value={formatCount(analytics.totals.events, locale, dash)}
            hint={suppressed(analytics.totals.events) ? hint : null}
          />
          <KpiCell
            label={t("kpi.registrations")}
            value={formatCount(analytics.totals.registrations, locale, dash)}
            hint={suppressed(analytics.totals.registrations) ? hint : null}
          />
          <KpiCell
            label={t("kpi.check_ins")}
            value={formatCount(analytics.totals.checkIns, locale, dash)}
            hint={suppressed(analytics.totals.checkIns) ? hint : null}
          />
        </View>
        {seriesChartable(analytics.series) ? (
          <Sparkline points={analytics.series} a11yLabel={t("kpi.trend_a11y")} />
        ) : null}
        {anySuppressed ? <Text style={styles.note}>{hint}</Text> : null}
      </View>
    </View>
  )
}

const MIN_TOUCH_TARGET = 44

const useStyles = makeThemedStyles((t) => ({
  section: {
    gap: t.space["2"],
  },
  chips: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  chipOn: {
    backgroundColor: t.colors.brand.bloom,
  },
  chipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  chipText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  chipTextOn: {
    color: t.colors.onAccent,
  },
  card: {
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  grid: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  cellValue: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    color: t.colors.text,
  },
  cellLabel: {
    marginTop: 2,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  note: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
