/**
 * KeyboardAnchorView — the platform-split view that applies a `useKeyboardAnchor` lift.
 *
 * WHY IT EXISTS: `anchor.liftStyle` is a reanimated animated style on native, which only an
 * `Animated.View` can consume — but SHARED (platform-neutral) bodies may not import reanimated
 * (packages/ui/eslint.config.js bans it outside *.native.*). A shared body renders
 * `<KeyboardAnchorView anchor={a}>` and the seam picks the right host view.
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
