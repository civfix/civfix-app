import React from "react"
import { View } from "react-native"
import { useTheme } from "../../../theme"
import { useAnalyticsStyles } from "./analyticsStyles"

// A known count keeps a visible sliver even when it rounds to nothing against the largest bar.
const MIN_FILL_PERCENT = 2

export function FractionBar({ fraction, ghost }: { fraction: number; ghost: boolean }) {
  const styles = useAnalyticsStyles()
  const th = useTheme()
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.max(ghost ? 0 : MIN_FILL_PERCENT, fraction * 100)}%`,
            backgroundColor: ghost ? th.colors.chartTrack : th.colors.accent,
          },
        ]}
      />
    </View>
  )
}
