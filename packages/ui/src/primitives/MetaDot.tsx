import React from "react"
import { View, StyleSheet, type ViewStyle } from "react-native"
import { space, useTheme } from "../theme"

export function MetaDot({ color, style }: { color?: string; style?: ViewStyle }) {
  const t = useTheme()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.dot, { backgroundColor: color ?? t.colors.borderStrong }, style]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: space["1"],
    flexShrink: 0,
  },
})
