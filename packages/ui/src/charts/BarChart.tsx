import React from "react"
import { View } from "react-native"
import Svg, { Rect } from "react-native-svg"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import {
  DEFAULT_BAR_GAP,
  DEFAULT_BAR_RADIUS,
  barFraction,
  barRects,
  chartMax,
} from "./chartGeometry"

const HORIZONTAL_BAR_HEIGHT = 8

const HORIZONTAL_LABEL_GAP = 2

export interface ChartBar {
  key: string
  label?: string
  value: number | null
  color: string
  stackValue?: number
  stackColor?: string
  valueLabel?: string
}

export interface BarChartProps {
  bars: readonly ChartBar[]
  width?: number
  height?: number
  horizontal?: boolean
  maxValue?: number
  barRadius?: number
  gap?: number
  xLabels?: readonly { index: number; text: string }[]
  labelColor: string
  trackColor?: string
  accessibilityLabel: string
}

export function BarChart({
  bars,
  width = 0,
  height = 0,
  horizontal = false,
  maxValue,
  barRadius = DEFAULT_BAR_RADIUS,
  gap = DEFAULT_BAR_GAP,
  xLabels,
  labelColor,
  trackColor,
  accessibilityLabel,
}: BarChartProps) {
  const styles = useStyles()
  const max = maxValue ?? chartMax(bars.flatMap((bar) => [bar.value, bar.stackValue ?? null]))

  if (horizontal) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={styles.rows}
      >
        {bars.map((bar) => (
          <View key={bar.key} style={styles.row}>
            <View style={styles.rowHead}>
              {bar.label ? (
                <Text variant="caption" numberOfLines={1} style={styles.rowLabel}>
                  {bar.label}
                </Text>
              ) : null}
              {bar.valueLabel ? (
                <Text variant="caption" numberOfLines={1}>
                  {bar.valueLabel}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.track,
                trackColor ? { backgroundColor: trackColor } : null,
                { borderRadius: barRadius },
              ]}
            >
              <View
                style={{
                  width: `${barFraction(bar.value, max) * 100}%`,
                  height: "100%",
                  borderRadius: barRadius,
                  backgroundColor: bar.color,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    )
  }

  const rects = barRects(
    bars.map((bar) => ({ key: bar.key, value: (bar.value ?? 0) + (bar.stackValue ?? 0) })),
    width,
    height,
    { max, gap },
  )
  const bases = barRects(
    bars.map((bar) => ({ key: bar.key, value: bar.value })),
    width,
    height,
    { max, gap },
  )

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.column}>
      <Svg width={width} height={height}>
        {rects.map((rect, index) => {
          const bar = bars[index] as ChartBar
          const base = bases[index] as typeof rect
          return (
            <React.Fragment key={rect.key}>
              {bar.stackValue && bar.stackColor ? (
                <Rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={barRadius}
                  fill={bar.stackColor}
                />
              ) : null}
              <Rect
                x={base.x}
                y={base.y}
                width={base.width}
                height={base.height}
                rx={barRadius}
                fill={bar.color}
              />
            </React.Fragment>
          )
        })}
      </Svg>
      {xLabels && xLabels.length > 0 ? (
        <View style={[styles.xLabels, { width }]}>
          {xLabels.map((label) => (
            <Text
              key={`${label.index}`}
              variant="caption"
              numberOfLines={1}
              style={[
                styles.xLabel,
                { color: labelColor, left: (label.index / Math.max(1, bars.length)) * width },
              ]}
            >
              {label.text}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  column: {
    gap: t.space["1"],
  },
  rows: {
    gap: t.space["2"],
  },
  row: {
    gap: HORIZONTAL_LABEL_GAP,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  rowLabel: {
    flexShrink: 1,
  },
  track: {
    height: HORIZONTAL_BAR_HEIGHT,
    width: "100%",
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  xLabels: {
    height: 14,
  },
  xLabel: {
    position: "absolute",
    top: 0,
  },
}))
