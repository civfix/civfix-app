import React from "react"
import { View } from "react-native"
import { useTheme, pinGlow } from "../../theme"
import { PinSvg, DROP_PIN_GLYPH } from "./PinSvg"

export const DROP_PIN_SIZE = 52

export const DropPin = React.memo(function DropPin({ size = DROP_PIN_SIZE }: { size?: number }) {
  const t = useTheme()
  return (
    <View style={pinGlow(t.colors.brand.bloom, 6, 8, 0.45, 9)}>
      <PinSvg fill={t.colors.brand.bloom} glyph={DROP_PIN_GLYPH} size={size} />
    </View>
  )
})
