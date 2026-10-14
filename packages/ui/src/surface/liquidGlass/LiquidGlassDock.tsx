/**
 * No Skia here: web bundlers and tsc resolve this extension-less file, so it must not pull Skia in. The
 * web dock is two BlurSurface panes on the same `dockShapes` geometry as native, rendered statically at
 * progress 0; the SDF morph is a native-only Skia treatment.
 */
import React from "react"
import { View } from "react-native"
import { BlurSurface } from "../BlurSurface"
import { dockShapes, dockRadius } from "./liquidGlassModel"
import type { LiquidGlassDockProps } from "./LiquidGlassDock.types"

export function LiquidGlassDock({ regionW, children, style }: LiquidGlassDockProps) {
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
