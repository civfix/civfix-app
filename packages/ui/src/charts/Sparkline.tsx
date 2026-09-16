import React from "react"
import { View } from "react-native"
import Svg, { Path, Polyline } from "react-native-svg"
import { chartMax, sparklineAreaPath, sparklineSegments } from "./chartGeometry"

export const SPARKLINE_STROKE_WIDTH = 1.5

export interface SparklineProps {
  points: readonly (number | null)[]
  width: number
  height: number
  stroke: string
  strokeWidth?: number
  /** Area fill under the line; omit for a bare line. */
  fill?: string
  accessibilityLabel: string
}

export function Sparkline({
  points,
  width,
  height,
  stroke,
  strokeWidth = SPARKLINE_STROKE_WIDTH,
  fill,
  accessibilityLabel,
}: SparklineProps) {
  const inset = strokeWidth
  const plotWidth = Math.max(0, width - inset * 2)
  const plotHeight = Math.max(0, height - inset * 2)
  const max = chartMax(points)
  const segments = sparklineSegments(points, plotWidth, plotHeight, max)
  const area = fill ? sparklineAreaPath(points, plotWidth, plotHeight, max) : null

  if (width <= 0 || height <= 0) {
    return <View style={{ width, height }} accessibilityLabel={accessibilityLabel} />
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {area && fill ? <Path d={area} fill={fill} translateX={inset} translateY={inset} /> : null}
        {segments.map((segment) => (
          <Polyline
            key={segment}
            points={segment}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            translateX={inset}
            translateY={inset}
          />
        ))}
      </Svg>
    </View>
  )
}
