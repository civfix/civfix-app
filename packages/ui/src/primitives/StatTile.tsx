import React from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { TrendSparkline } from "./TrendSparkline"
import { statValueSize, STAT_VALUE_UNKNOWN, type StatTileColumns } from "./statTileModel"
import type { SparkPoint } from "./trendSparklineModel"

const TREND_HEIGHT = 24
const LABEL_LINES = 2
const CAPTION_LINE_HEIGHT = 16
const CELL_BASIS: Readonly<Record<StatTileColumns, `${number}%`>> = {
  2: "46%",
  4: "21%",
}

const StatTileColumnsContext = React.createContext<StatTileColumns>(2)

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
  const columns = React.useContext(StatTileColumnsContext)
  const shown = value ?? STAT_VALUE_UNKNOWN
  const size = statValueSize(value, columns)
  return (
    <View
      style={styles.tile}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${shown}`}
      accessibilityRole="summary"
    >
      <Text variant="caption" numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          size === "20" ? styles.value20 : null,
          size === "18" ? styles.value18 : null,
          value === null ? styles.valueUnknown : null,
          tone === "success" ? styles.valueSuccess : null,
          tone === "danger" ? styles.valueDanger : null,
        ]}
        numberOfLines={1}
      >
        {shown}
      </Text>
      {hint ? (
        <Text variant="caption" numberOfLines={3}>
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
    <StatTileColumnsContext.Provider value={columns}>
      <View style={styles.row}>
        {cells.map((cell, index) => (
          <View key={index} style={[styles.cell, { flexBasis: CELL_BASIS[columns] }]}>
            {cell}
          </View>
        ))}
      </View>
    </StatTileColumnsContext.Provider>
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
  label: {
    minHeight: LABEL_LINES * CAPTION_LINE_HEIGHT,
  },
  value: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    lineHeight: 28,
    letterSpacing: -0.4,
    color: t.colors.text,
  },
  value20: {
    fontSize: t.fontSize["20"],
    lineHeight: 26,
  },
  value18: {
    fontSize: t.fontSize["18"],
    lineHeight: 24,
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
