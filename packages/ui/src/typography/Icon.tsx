import React from "react"

/** Structural rather than lucide's own `LucideIcon`, so the public seam does not leak the dependency's internals. */
export type LucideIcon = React.ComponentType<{
  size?: number
  color?: string
  strokeWidth?: number
}>

export interface IconProps {
  icon: LucideIcon
  size?: number
  color?: string
  strokeWidth?: number
}

export function Icon({ icon: IconCmp, size, color, strokeWidth }: IconProps) {
  return <IconCmp size={size} color={color} strokeWidth={strokeWidth ?? 2} />
}
