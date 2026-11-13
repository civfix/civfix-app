import { StyleSheet, View } from "react-native"
import Svg, { Circle, Path, Rect } from "react-native-svg"
import { pointerEventStyles, type ColorSchemeName } from "../theme"
import { ACTIVE_SEASON, seasonLook } from "../theme/season"

/**
 * The season's hat, tilted onto the "c" of a wordmark whose letters are `size` tall. Rendered inside the
 * wordmark's row, which places it; nothing when the active season has no hat. Decorative, so it never takes
 * a tap and screen readers skip it: the wordmark keeps its own "civfix" label.
 */
export function SeasonHat({ size, scheme }: { size: number; scheme: ColorSchemeName }) {
  const hat = seasonLook(ACTIVE_SEASON)?.hat?.[scheme]
  if (!hat) return null
  const width = size * 0.62
  return (
    <View
      style={[styles.hat, { left: -size * 0.12, top: size * 0.02 }, pointerEventStyles.none]}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={width * 0.8} viewBox="0 0 40 32">
        <Path d="M5 24 C8 11 18 2 31 5 C34 6 36.5 9 37 13 C31 9.5 25 12 23 24 Z" fill={hat.felt} />
        <Rect
          x={2}
          y={21}
          width={25}
          height={8.5}
          rx={4.25}
          fill={hat.trim}
          stroke={hat.edge}
          strokeWidth={1.2}
        />
        <Circle cx={36.5} cy={15} r={4.2} fill={hat.trim} stroke={hat.edge} strokeWidth={1.2} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  hat: {
    position: "absolute",
    transform: [{ rotate: "-14deg" }],
  },
})
