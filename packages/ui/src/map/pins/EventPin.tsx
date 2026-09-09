import React from "react"
import { View } from "react-native"
import type { EventKind } from "@civfix/shared"
import { cleanupColorFor } from "@civfix/shared/tokens"
import { pinGlow, useTheme, type Theme } from "../../theme"
import { PinSvg, PinBadge, PIN_GLYPHS, type PinBadge as PinBadgeValue } from "./PinSvg"

function pinForKind(eventKind: EventKind, t: Theme): { fill: string; glyph: string } {
  if (eventKind === "other_volunteer") {
    return { fill: t.colors.brand.lilac, glyph: PIN_GLYPHS.other_volunteer! }
  }
  return { fill: cleanupColorFor(t.scheme), glyph: PIN_GLYPHS.cleanup! }
}

export const EventPin = React.memo(function EventPin({
  size = 38,
  active = false,
  eventKind = "cleanup",
  badge = null,
}: {
  size?: number
  active?: boolean
  eventKind?: EventKind
  badge?: PinBadgeValue
}) {
  const t = useTheme()
  const w = active ? 50 : size
  const { fill, glyph } = pinForKind(eventKind, t)
  return (
    <View style={active ? pinGlow(fill, 6, 7, 0.4, 8) : undefined}>
      <PinSvg fill={fill} glyph={glyph} size={w} />
      <PinBadge badge={badge} />
    </View>
  )
}, (prev, next) =>
  prev.size === next.size &&
  prev.active === next.active &&
  prev.eventKind === next.eventKind &&
  prev.badge === next.badge,
)
