/**
 * LiquidGlassDock (web + platform-agnostic default seam).
 *
 * NO SKIA HERE: @civfix/ui ships raw source, and web bundlers/tsc resolve this extension-less file
 * (Metro picks the sibling .native.tsx). The web dock keeps the existing CSS-glass approach: two
 * BlurSurface(kind="dock") panes - the left tab capsule and the right search orb - positioned per the
 * same `dockShapes` geometry the native seam uses, so call sites are identical across platforms.
 *
 * The morph is intentionally STATIC on web (rendered at the resting progress-0 geometry; the `progress`
 * shared value is accepted but not animated): the liquid SDF merge is a native-only Skia treatment, and
 * the web portrait shell keeps its existing CSS glass path per the redesign plan.
 */
import React from "react"
import { View } from "react-native"
import { BlurSurface } from "../BlurSurface"
import { dockShapes, dockRadius } from "./liquidGlassModel"
import type { LiquidGlassDockProps } from "./LiquidGlassDock.types"

export function LiquidGlassDock({ regionW, children, style }: LiquidGlassDockProps) {
  // Resting geometry (progress 0): wide tab capsule + detached search orb.
  const { left, right } = dockShapes(0, regionW)
  const radius = dockRadius()
  return (
    <View style={style}>
      <BlurSurface
        kind="dock"
        pointerEvents="none"
        style={{
          position: "absolute",
          left: left.x,
          top: left.y,
          width: left.width,
          height: left.height,
          borderRadius: radius,
          overflow: "hidden",
        }}
      />
      <BlurSurface
        kind="dock"
        pointerEvents="none"
        style={{
          position: "absolute",
          left: right.x,
          top: right.y,
          width: right.width,
          height: right.height,
          borderRadius: radius,
          overflow: "hidden",
        }}
      />
      {children}
    </View>
  )
}
