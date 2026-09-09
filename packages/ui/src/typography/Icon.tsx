/**
 * Icon - a thin, theme-agnostic wrapper over a lucide-react-native glyph component.
 *
 * Consumers pass a lucide icon component (directly, or via the semantic `icon-map`) plus size /
 * color / strokeWidth. Authored in RN primitives only: lucide-react-native renders to react-native-svg
 * on native and to react-native-web's SVG shim on web, so the SAME wrapper works on both platforms.
 * We default strokeWidth to 2 (lucide's own default) so call sites can omit it.
 */
import React from "react"

/**
 * Structural type for a lucide-react-native icon component. We intentionally keep this loose (just
 * the props we forward) rather than importing lucide's exact `LucideIcon` type, so the public seam
 * does not leak the dependency's internals; any forwardRef icon component satisfies it.
 */
export type LucideIcon = React.ComponentType<{
  size?: number
  color?: string
  strokeWidth?: number
}>

export interface IconProps {
  /** The lucide-react-native glyph to render (e.g. from `icon-map`). */
  icon: LucideIcon
  /** Square size in px. Defaults to lucide's 24. */
  size?: number
  /** Stroke color. Defaults to lucide's currentColor behavior when omitted. */
  color?: string
  /** Stroke width. Defaults to 2 (lucide's default). */
  strokeWidth?: number
}

export function Icon({ icon: IconCmp, size, color, strokeWidth }: IconProps) {
  return <IconCmp size={size} color={color} strokeWidth={strokeWidth ?? 2} />
}
