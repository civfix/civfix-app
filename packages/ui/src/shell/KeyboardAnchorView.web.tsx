/**
 * KeyboardAnchorView (web seam) — a plain RN View. On web `anchor.liftStyle` is already a plain style
 * object carrying a CSS `translateY` + `transition`, so no animated host is needed (and reanimated must
 * never reach the RNW bundle). The anchor's style goes LAST, matching the native seam.
 */
import React from "react"
import { View } from "react-native"
import type { KeyboardAnchorViewProps } from "./KeyboardAnchorView.types"

export function KeyboardAnchorView({ anchor, style, children, pointerEvents }: KeyboardAnchorViewProps) {
  return (
    <View style={[style, anchor.liftStyle]} pointerEvents={pointerEvents}>
      {children}
    </View>
  )
}
