import React from "react"
import { View } from "react-native"
import Svg, { Line, Path } from "react-native-svg"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import {
  chartMax,
  lineGeometry,
  valueToPixels,
  xToPixels,
  type ChartPoint,
} from "./chartGeometry"

const AXIS_LABEL_HEIGHT = 14

const LINE_WIDTH = 2

const REF_DASH = "4 4"

export interface AreaLineChartProps {
  series: readonly ChartPoint[]
  width: number
  height: number
  stroke: string
  fill?: string
  refLineY?: number
  refLineColor?: string
  markerX?: number
  markerColor?: string
  xTicks?: readonly { x: number; label: string }[]
  gridColor: string
  labelColor: string
  accessibilityLabel: string
}

export function AreaLineChart({
  series,
  width,
  height,
  stroke,
  fill,
  refLineY,
  refLineColor,
  markerX,
  markerColor,
  xTicks,
  gridColor,
  labelColor,
  accessibilityLabel,
}: AreaLineChartProps) {
  const styles = useStyles()
  const values = series.map((point) => point.y)
  const max = chartMax(refLineY === undefined ? values : [...values, refLineY])
  const xs = series.map((point) => point.x)
  const xMin = xs.length > 0 ? Math.min(...xs) : 0
  const xMax = xs.length > 0 ? Math.max(...xs) : 1
  const geometry = lineGeometry(series, width, height, { max, xMin, xMax })

  if (width <= 0 || height <= 0) {
    return <View style={{ width, height }} accessibilityLabel={accessibilityLabel} />
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.root}>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height} x2={width} y2={height} stroke={gridColor} strokeWidth={1} />
        {refLineY !== undefined && refLineColor ? (
          <Line
            x1={0}
            y1={valueToPixels(refLineY, max, height)}
            x2={width}
            y2={valueToPixels(refLineY, max, height)}
            stroke={refLineColor}
            strokeWidth={1}
            strokeDasharray={REF_DASH}
          />
        ) : null}
        {markerX !== undefined && markerColor && xMax > xMin ? (
          <Line
            x1={xToPixels(markerX, xMin, xMax, width)}
            y1={0}
            x2={xToPixels(markerX, xMin, xMax, width)}
            y2={height}
            stroke={markerColor}
            strokeWidth={1}
            strokeDasharray={REF_DASH}
          />
        ) : null}
        {geometry.area && fill ? <Path d={geometry.area} fill={fill} /> : null}
        {geometry.line ? (
          <Path
            d={geometry.line}
            fill="none"
            stroke={stroke}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
      {xTicks && xTicks.length > 0 ? (
        <View style={[styles.ticks, { width }]}>
          {xTicks.map((tick) => (
            <Text
              key={tick.label}
              variant="caption"
              numberOfLines={1}
              style={[styles.tick, { color: labelColor, left: xToPixels(tick.x, xMin, xMax, width) }]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["1"],
  },
  ticks: {
    height: AXIS_LABEL_HEIGHT,
  },
  tick: {
    position: "absolute",
    top: 0,
  },
}))
