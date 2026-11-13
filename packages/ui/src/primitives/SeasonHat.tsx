import Svg, { Circle, Path, Rect } from "react-native-svg"
import { seasonLook } from "@civfix/tokens"
import { useColorSchemeName } from "../theme"

/** The holiday hat that sits on the wordmark's "c"; nothing when no season with a hat is on. */
export function SeasonHat({ width }: { width: number }) {
  const scheme = useColorSchemeName()
  const hat = seasonLook?.hat?.[scheme]
  if (!hat) return null
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 40 32" accessibilityElementsHidden>
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
  )
}
