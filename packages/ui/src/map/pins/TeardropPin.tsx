import React from "react"
import { View } from "react-native"
import { categoryColor, pinGlow, useTheme, type CategoryColorKey } from "../../theme"
import { PinSvg, PinBadge, glyphForCategory, type PinBadge as PinBadgeValue } from "./PinSvg"

export const TeardropPin = React.memo(function TeardropPin({
  category,
  size = 38,
  active = false,
  badge = null,
}: {
  category: CategoryColorKey | string
  size?: number
  active?: boolean
  badge?: PinBadgeValue
}) {
  const t = useTheme()
  const color = categoryColor(category, t.scheme)
  const w = active ? 50 : size
  return (
    <View style={active ? pinGlow(color, 6, 7, 0.4, 8) : undefined}>
      <PinSvg fill={color} glyph={glyphForCategory(category)} size={w} />
      <PinBadge badge={badge} />
    </View>
  )
}, (prev, next) =>
  prev.category === next.category &&
  prev.size === next.size &&
  prev.active === next.active &&
  prev.badge === next.badge,
)
