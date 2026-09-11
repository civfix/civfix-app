import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { TrendSparkline } from "./TrendSparkline"
import { STAT_VALUE_UNKNOWN, type StatTileColumns } from "./statTileModel"
import type { SparkPoint } from "./trendSparklineModel"

const TREND_HEIGHT = 24
const CELL_BASIS: Readonly<Record<StatTileColumns, `${number}%`>> = {
  2: "46%",
  4: "21%",
}

export type StatTone = "neutral" | "success" | "danger"

export interface StatTileProps {
  label: string
  value: string | null
  hint?: string
  trend?: readonly SparkPoint[]
  tone?: StatTone
  accessibilityLabel?: string
}

export interface StatTileRowProps {
  children: React.ReactNode
  columns?: StatTileColumns
}

export function StatTile({
  label,
  value,
  hint,
  trend,
  tone = "neutral",
  accessibilityLabel,
}: StatTileProps) {
  const styles = useStyles()
  const shown = value ?? STAT_VALUE_UNKNOWN
  return (
    <View
      style={styles.tile}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${shown}`}
      accessibilityRole="summary"
    >
      <Text variant="caption" numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          value === null ? styles.valueUnknown : null,
          tone === "success" ? styles.valueSuccess : null,
          tone === "danger" ? styles.valueDanger : null,
        ]}
        numberOfLines={1}
      >
        {shown}
      </Text>
      {hint ? (
        <Text variant="caption" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      {trend && trend.length > 0 ? (
        <TrendSparkline
          points={trend}
          kind="bars"
          height={TREND_HEIGHT}
          accessibilityLabel={accessibilityLabel ?? label}
        />
      ) : null}
    </View>
  )
}

export function StatTileRow({ children, columns = 2 }: StatTileRowProps) {
  const styles = useStyles()
  const cells = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={styles.row}>
      {cells.map((cell, index) => (
        <View key={index} style={[styles.cell, { flexBasis: CELL_BASIS[columns] }]}>
          {cell}
        </View>
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  cell: {
    flexGrow: 1,
    minWidth: 0,
  },
  tile: {
    flex: 1,
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  value: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    lineHeight: 28,
    letterSpacing: -0.4,
    color: t.colors.text,
  },
  valueUnknown: {
    color: t.colors.textSubtle,
  },
  valueSuccess: {
    color: t.colors.successInk,
  },
  valueDanger: {
    color: t.colors.dangerInk,
  },
}))
