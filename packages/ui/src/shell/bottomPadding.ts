import { StyleSheet, type StyleProp, type ViewStyle } from "react-native"

// Additive to the style's own bottom gutter: a bare `{ paddingBottom: extra }` override would erase it.
export function withExtraBottomPadding<S>(style: S, extra: number): [S, { paddingBottom: number }] {
  const flat = StyleSheet.flatten(style as StyleProp<ViewStyle>) || {}
  const basePad = typeof flat.paddingBottom === "number" ? flat.paddingBottom : 0
  return [style, { paddingBottom: basePad + extra }]
}
