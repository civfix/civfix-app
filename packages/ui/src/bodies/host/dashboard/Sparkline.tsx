import React from "react"
import { View } from "react-native"
import type { SeriesPoint } from "@civfix/shared"
import { makeThemedStyles } from "../../../theme"
import { sparklineBars } from "./dashboardModel"

const TRACK_HEIGHT = 34

const MIN_BAR = 2

export interface SparklineProps {
  points: readonly SeriesPoint[]
  a11yLabel: string
}

export function Sparkline({ points, a11yLabel }: SparklineProps) {
  const styles = useStyles()
  const bars = sparklineBars(points)
  return (
    <View
      style={styles.track}
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
    >
      {bars.map((bar, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            bar.suppressed ? styles.barSuppressed : null,
            { height: Math.max(MIN_BAR, bar.height * TRACK_HEIGHT) },
          ]}
        />
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: {
    height: TRACK_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.brand.moss,
  },
  barSuppressed: {
    backgroundColor: t.colors.border,
  },
}))
