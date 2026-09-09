/**
 * KeyboardAnchorView (native seam) — an Animated.View carrying the anchor's reanimated lift style.
 * The anchor's style goes LAST so a caller's static `style` can never clobber the transform.
 */
import React from "react"
import Animated from "react-native-reanimated"
import type { KeyboardAnchorViewProps } from "./KeyboardAnchorView.types"

export function KeyboardAnchorView({ anchor, style, children, pointerEvents }: KeyboardAnchorViewProps) {
  return (
    <Animated.View style={[style, anchor.liftStyle]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  )
}
