import React, { useState } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import Svg, { Circle, G, Path, Polyline } from "react-native-svg"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"
import {
  SPARK_END_DOT_RADIUS,
  SPARK_LINE_WIDTH,
  sparklineGeometry,
  type SparkPoint,
} from "./trendSparklineModel"

export type TrendSparklineKind = "bars" | "line"
export type TrendSparklineHeight = 24 | 56

export interface TrendSparklineProps {
  points: readonly SparkPoint[]
  kind: TrendSparklineKind
  height: TrendSparklineHeight
  endLabel?: string
  accessibilityLabel: string
  suppressedKeys?: ReadonlySet<string>
}

const LINE_INSET = SPARK_END_DOT_RADIUS + SPARK_LINE_WIDTH

export function TrendSparkline({
  points,
  kind,
  height,
  endLabel,
  accessibilityLabel,
  suppressedKeys,
}: TrendSparklineProps) {
  const styles = useStyles()
  const t = useTheme()
  const [width, setWidth] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)
  const line = kind === "line"
  const plotWidth = Math.max(0, line ? width - LINE_INSET : width)
  const plotHeight = Math.max(0, line ? height - LINE_INSET * 2 : height)
  const geometry = sparklineGeometry(points, plotWidth, plotHeight)

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height }]} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {line ? (
              <G transform={`translate(0, ${LINE_INSET})`}>
                <Polyline
                  points={geometry.polyline}
                  fill="none"
                  stroke={t.colors.chartInk}
                  strokeWidth={SPARK_LINE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {geometry.end ? (
                  <Circle
                    cx={geometry.end.x}
                    cy={geometry.end.y}
                    r={SPARK_END_DOT_RADIUS}
                    fill={t.colors.chartInk}
                    stroke={t.colors.surface}
                    strokeWidth={SPARK_LINE_WIDTH}
                  />
                ) : null}
              </G>
            ) : (
              geometry.bars.map((bar) =>
                bar.path ? (
                  <Path
                    key={bar.key}
                    d={bar.path}
                    fill={
                      bar.muted || suppressedKeys?.has(bar.key)
                        ? t.colors.chartInkMuted
                        : t.colors.chartInk
                    }
                  />
                ) : null,
              )
            )}
          </Svg>
        ) : null}
      </View>
      {endLabel ? (
        <Text variant="caption" style={styles.endLabel}>
          {endLabel}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["1"],
  },
  plot: {
    width: "100%",
    justifyContent: "flex-end",
  },
  endLabel: {
    textAlign: "right",
  },
}))
