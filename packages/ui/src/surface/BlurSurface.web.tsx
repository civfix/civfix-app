import React from "react"
import { View, type ViewStyle } from "react-native"
import { useTheme } from "../theme"
import type { BlurSurfaceProps } from "./types"

export function BlurSurface({ kind, children, style, pointerEvents }: BlurSurfaceProps) {
  const spec = useTheme().glass[kind]
  const filter = `blur(${spec.blurIntensity}px) saturate(180%)`
  const sheen = "sheen" in spec ? spec.sheen : undefined

  const glassStyle = {
    backgroundColor: spec.fill,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    ...(sheen ? { boxShadow: `inset 0 1px 0 ${sheen}` } : null),
    ...(pointerEvents ? { pointerEvents } : null),
  } as unknown as ViewStyle

  return <View style={[glassStyle, style]}>{children}</View>
}
