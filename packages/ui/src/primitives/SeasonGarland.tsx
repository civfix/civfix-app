import Svg, { Circle, G, Path } from "react-native-svg"
import { seasonLook } from "@civfix/tokens"
import { useColorSchemeName } from "../theme"

const HEIGHT = 14
const SPRIG_EVERY = 72
const LEAF = "M0 0 C3 -3.6 8 -3.6 11 0 C8 3.6 3 3.6 0 0 Z"

/** Holly hung along the top edge of the navigation pill; nothing when no season with a garland is on. */
export function SeasonGarland({ width }: { width: number }) {
  const scheme = useColorSchemeName()
  const garland = seasonLook?.garland?.[scheme]
  if (!garland || width <= 0) return null
  const swags = Math.max(1, Math.round(width / SPRIG_EVERY))
  const step = width / swags
  const knots = Array.from({ length: swags + 1 }, (_, i) => i * step)
  const cord = knots
    .slice(1)
    .map((x) => `Q ${x - step / 2} ${HEIGHT - 2} ${x} 4`)
    .join(" ")
  return (
    <Svg width={width} height={HEIGHT}>
      <Path d={`M 0 4 ${cord}`} stroke={garland.cord} strokeWidth={1.5} fill="none" />
      {knots.map((x, i) => {
        const cx = Math.min(Math.max(x, 12), width - 12)
        return (
          <G key={i} transform={`translate(${cx} 6)`}>
            <Path d={LEAF} fill={garland.leaf} transform="rotate(-22)" />
            <Path d={LEAF} fill={garland.leaf} transform="rotate(202)" />
            <Circle cx={-2} cy={1.5} r={2.3} fill={garland.berry} />
            <Circle cx={2.2} cy={1.8} r={2.3} fill={garland.berry} />
            <Circle cx={0} cy={-1.6} r={2.3} fill={garland.berry} />
          </G>
        )
      })}
    </Svg>
  )
}
