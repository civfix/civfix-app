import { View, type StyleProp, type ViewStyle } from "react-native"
import { makeThemedStyles } from "../theme"

const DOT_SIZE = 12

/**
 * The plain unread dot (no count) over the top-right of a round control or avatar. It carries no
 * accessible name of its own: the control it sits on says "unread" in its label instead.
 */
export function UnreadDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles()
  return <View style={[styles.dot, style]} />
}

const useStyles = makeThemedStyles((t) => ({
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: t.colors.brand.bloom,
    borderWidth: 2,
    borderColor: t.colors.neutral.card,
    pointerEvents: "none",
  },
}))
