import React from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"
import { DEFAULT_RING_THICKNESS, clampFraction, progressArcPath, ringRadius } from "./chartGeometry"

export interface ProgressRingProps {
  value: number
  size: number
  thickness?: number
  color: string
  trackColor: string
  children?: React.ReactNode
  accessibilityLabel: string
}

export function ProgressRing({
  value,
  size,
  thickness = DEFAULT_RING_THICKNESS,
  color,
  trackColor,
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const fraction = clampFraction(value)
  const arc = progressArcPath(fraction, size, thickness)
  const radius = ringRadius(size, thickness)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        {arc ? (
          <Path
            d={arc}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
})
