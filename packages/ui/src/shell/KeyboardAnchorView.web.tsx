/**
 * A plain View: on web `anchor.liftStyle` is already a plain CSS style, and reanimated must never reach
 * the react-native-web bundle.
 */
import { View } from "react-native"
import { pointerEventStyles } from "../theme"
import type { KeyboardAnchorViewProps } from "./KeyboardAnchorView.types"

export function KeyboardAnchorView({
  anchor,
  style,
  children,
  pointerEvents,
}: KeyboardAnchorViewProps) {
  return (
    <View
      style={[style, anchor.liftStyle, pointerEvents ? pointerEventStyles[pointerEvents] : null]}
    >
      {children}
    </View>
  )
}
