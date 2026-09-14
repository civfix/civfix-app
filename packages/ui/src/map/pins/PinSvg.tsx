import React from "react"
import { View } from "react-native"
import Svg, { Path, G } from "react-native-svg"
import { useTheme } from "../../theme"
import { Icon, iconMap } from "../../typography"

const BODY_PATH =
  "M32 4 C46 4 58 16 58 30 C58 46 40 60 34 68 C33 69 31 69 30 68 C24 60 6 46 6 30 C6 16 18 4 32 4 Z"

export function PinSvg({ fill, glyph, size }: { fill: string; glyph: string; size: number }) {
  const t = useTheme()
  return (
    <Svg width={size} height={size * (76 / 64)} viewBox="0 0 64 76" fill="none">
      <Path d={BODY_PATH} fill={fill} />
      <G
        transform="translate(20 16)"
        stroke={t.colors.onAccent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <Path d={glyph} />
      </G>
    </Svg>
  )
}

export type PinBadge = "plus" | "check" | null

const BADGE_SIZE = 17

export function PinBadge({ badge }: { badge: PinBadge }) {
  const t = useTheme()
  if (!badge) return null
  const fill = badge === "check" ? t.colors.brand.moss : t.colors.brand.bloom
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: BADGE_SIZE / 2,
        backgroundColor: fill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: t.colors.onAccent,
      }}
    >
      <Icon
        icon={badge === "check" ? iconMap.Check : iconMap.Plus}
        size={11}
        color={t.colors.onAccent}
        strokeWidth={2.5}
      />
    </View>
  )
}
