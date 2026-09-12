import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, Platform, View, type LayoutChangeEvent } from "react-native"
import { makeThemedStyles, useReducedMotion, useTheme } from "../theme"
import { meterFill, METER_WARN_AT } from "./meterModel"

export const METER_HEIGHT = 6

const USE_NATIVE_DRIVER = Platform.OS !== "web"

export interface MeterProps {
  value: number
  max: number
  warnAt?: number | null
  accessibilityLabel: string
}

export function Meter({ value, max, warnAt = METER_WARN_AT, accessibilityLabel }: MeterProps) {
  const styles = useStyles()
  const t = useTheme()
  const reducedMotion = useReducedMotion()
  const { ratio, state } = meterFill(value, max, warnAt)
  const grow = useRef(new Animated.Value(0)).current
  const [trackWidth, setTrackWidth] = useState(0)
  const onTrackLayout = useCallback((layout: LayoutChangeEvent) => {
    setTrackWidth(layout.nativeEvent.layout.width)
  }, [])

  useEffect(() => {
    if (reducedMotion === null) return
    if (reducedMotion) {
      grow.setValue(ratio)
      return
    }
    const run = Animated.timing(grow, {
      toValue: ratio,
      duration: t.motion.dur.d3,
      easing: Easing.bezier(...t.motion.easing),
      useNativeDriver: USE_NATIVE_DRIVER,
    })
    run.start()
    return () => run.stop()
  }, [grow, ratio, reducedMotion, t.motion])

  const anchor = grow.interpolate({
    inputRange: [0, 1],
    outputRange: [-trackWidth / 2, 0],
  })

  return (
    <View
      style={styles.track}
      onLayout={onTrackLayout}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <Animated.View
        style={[
          styles.fill,
          state === "ok" ? styles.fillOk : styles.fillWarn,
          { transform: [{ translateX: anchor }, { scaleX: grow }] },
        ]}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  track: {
    height: METER_HEIGHT,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.chartTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    width: "100%",
    borderRadius: t.radius.pill,
  },
  fillOk: {
    backgroundColor: t.colors.chartInk,
  },
  fillWarn: {
    backgroundColor: t.colors.sun["600"],
  },
}))
