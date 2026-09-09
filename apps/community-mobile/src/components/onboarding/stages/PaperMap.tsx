import React from "react"
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native"
import Svg, { G, Path } from "react-native-svg"
import { makeThemedStyles, useTheme } from "@/theme"

const MAJOR_STREETS = ["M0 34 H120", "M0 62 H120", "M26 0 V120", "M62 0 V120", "M0 10 L120 72"]
const MINOR_STREETS = ["M0 20 H120", "M0 90 H120", "M44 0 V120", "M94 0 V120", "M0 108 H120"]

const PARK = "M12 16 C30 6 54 12 58 29 C62 46 40 55 23 49 C9 44 3 26 12 16 Z"
const WATER = "M0 84 C18 76 34 95 52 91 C74 86 92 103 120 95 L120 120 L0 120 Z"

export function mapSpot(
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
): ViewStyle {
  return {
    position: "absolute",
    left: `${x * 100}%` as DimensionValue,
    top: `${y * 100}%` as DimensionValue,
    marginLeft: offsetX,
    marginTop: offsetY,
  }
}

export const PaperMap = React.memo(function PaperMap({
  style,
}: {
  style?: StyleProp<ViewStyle>
}) {
  const th = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.map, style]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
        <Path d={PARK} fill={th.colors.moss["50"]} />
        <Path d={WATER} fill={th.colors.sky["50"]} />
        <G stroke={th.colors.border} strokeLinecap="round" fill="none">
          <G strokeWidth={1.2}>
            {MINOR_STREETS.map((d) => (
              <Path key={d} d={d} />
            ))}
          </G>
          <G strokeWidth={2.6}>
            {MAJOR_STREETS.map((d) => (
              <Path key={d} d={d} />
            ))}
          </G>
        </G>
      </Svg>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  map: {
    overflow: "hidden",
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
  },
}))
