/**
 * `anchor.liftStyle` is a reanimated style on native, which only an Animated.View can consume, but
 * platform-neutral bodies may not import reanimated (eslint bans it outside *.native.*). A shared body
 * renders `<KeyboardAnchorView anchor={a}>` and the seam picks the host view.
 */
import type React from "react"
import type { StyleProp, ViewProps, ViewStyle } from "react-native"
import type { KeyboardAnchor } from "./useKeyboardAnchor.types"

export interface KeyboardAnchorViewProps {
  anchor: KeyboardAnchor
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
  pointerEvents?: ViewProps["pointerEvents"]
}
