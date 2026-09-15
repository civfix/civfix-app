import React from "react"
import { View } from "react-native"
import type { EventKind } from "@civfix/shared"
import { pinGlow, useTheme } from "../../theme"
import { PinSvg, PinBadge, type PinBadge as PinBadgeValue } from "./PinSvg"
import { eventPinTarget, pinAppearanceFor } from "./appearance"

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
  const { fill, glyph } = pinAppearanceFor(eventPinTarget(eventKind), t.scheme)
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
