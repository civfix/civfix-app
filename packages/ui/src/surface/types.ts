/**
 * Shared types for the BlurSurface seam. BlurSurface is the single component that renders the
 * civfix "glass" backdrop; its implementation is platform-split (`.native` uses expo-blur, `.web`
 * uses CSS backdrop-filter), but both seam files share this contract so call sites are identical.
 */
import type React from "react"
import type { StyleProp, ViewStyle } from "react-native"

/** Which glass spec to read from `theme.glass` (fill / blur intensity differ per surface kind). */
export type GlassKind = "button" | "sheet" | "popover" | "dock"

export interface BlurSurfaceProps {
  /** Selects the theme.glass[kind] fill + blur intensity. */
  kind: GlassKind
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Forwarded to the underlying View (e.g. "none" to let touches fall through a backdrop). */
  pointerEvents?: ViewStyle["pointerEvents"]
}
