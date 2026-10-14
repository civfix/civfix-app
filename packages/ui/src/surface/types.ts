import type React from "react"
import type { StyleProp, ViewStyle } from "react-native"

export type GlassKind = "button" | "sheet" | "popover" | "dock"

export interface BlurSurfaceProps {
  kind: GlassKind
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  pointerEvents?: ViewStyle["pointerEvents"]
}
