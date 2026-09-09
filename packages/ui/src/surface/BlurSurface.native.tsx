import React from "react"
import { View, StyleSheet, type ViewStyle } from "react-native"
import { BlurView } from "expo-blur"
import { useTheme, supportsBlur } from "../theme"
import type { BlurSurfaceProps } from "./types"

export function BlurSurface({ kind, children, style, pointerEvents }: BlurSurfaceProps) {
  const t = useTheme()
  const spec = t.glass[kind]
  const sheen = "sheen" in spec ? spec.sheen : undefined
  const peStyle: ViewStyle | null = pointerEvents ? { pointerEvents } : null

  return (
    <View style={[style, peStyle]}>
      {supportsBlur ? (
        <BlurView
          intensity={spec.blurIntensity}
          tint={t.scheme === "dark" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.noPointer,
          { backgroundColor: supportsBlur ? spec.fill : spec.fillFallback },
        ]}
      />
      {sheen ? (
        <View style={[styles.sheen, styles.noPointer, { backgroundColor: sheen }]} />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  noPointer: {
    pointerEvents: "none",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
})
