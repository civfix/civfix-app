import { View } from "react-native"
import { useTheme, webStyle } from "../theme"
import type { BlurSurfaceProps } from "./types"

export function BlurSurface({ kind, children, style, pointerEvents }: BlurSurfaceProps) {
  const spec = useTheme().glass[kind]
  const filter = `blur(${spec.blurIntensity}px) saturate(180%)`
  const sheen = "sheen" in spec ? spec.sheen : undefined

  const glassStyle = webStyle({
    backgroundColor: spec.fill,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    ...(sheen ? { boxShadow: `inset 0 1px 0 ${sheen}` } : null),
    ...(pointerEvents ? { pointerEvents } : null),
  })

  return <View style={[glassStyle, style]}>{children}</View>
}
