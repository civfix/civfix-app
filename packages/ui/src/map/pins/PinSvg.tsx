import React from "react"
import { View } from "react-native"
import Svg, { Path, G } from "react-native-svg"
import { useTheme } from "../../theme"
import { Icon, iconMap } from "../../typography"

const BODY_PATH =
  "M32 4 C46 4 58 16 58 30 C58 46 40 60 34 68 C33 69 31 69 30 68 C24 60 6 46 6 30 C6 16 18 4 32 4 Z"

export const DROP_PIN_GLYPH = "M12 5 V19 M5 12 H19"

export const PIN_GLYPHS: Record<string, string> = {
  hazard: "M12 4 L2 20 H22 L12 4 Z M12 10 v4 M12 17 v0.5",
  encampment: "M3.5 21 L14 3 M20.5 21 L10 3 M15.5 21 L12 15 L8.5 21 M3.5 21 H20.5",
  cleanup:
    "M6 6 H18 a2 2 0 0 1 2 2 V19 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 V8 a2 2 0 0 1 2 -2 Z M8 4 V7 M16 4 V7 M4 10 H20",
  other_volunteer:
    "M12 20 C12 20 4 14.5 4 9 C4 6.5 6 5 8 5 C9.8 5 11.2 6 12 7.5 C12.8 6 14.2 5 16 5 C18 5 20 6.5 20 9 C20 14.5 12 20 12 20 Z",
  trash:
    "M9 6 L9 5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 v1 M5 6 h14 M6 6 l1 12 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l1 -12 M10 11 v5 M14 11 v5",
  recycling: "M12 4 L8 11 H16 L12 4 Z M5 13 L3 17 L7 19 M19 13 L21 17 L17 19 M8 20 H16",
  graffiti: "M4 14 v3 a2 2 0 0 0 2 2 h2 v-3 M4 14 l9 -9 a2.83 2.83 0 0 1 4 4 l-9 9 H4 v-4 Z",
  water: "M12 3 C7 8 4 12 4 15 a8 8 0 0 0 16 0 c0 -3 -3 -7 -8 -12 Z",
  drop: DROP_PIN_GLYPH,
}

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

export function glyphForCategory(category: string): string {
  return PIN_GLYPHS[category] ?? PIN_GLYPHS.trash!
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
