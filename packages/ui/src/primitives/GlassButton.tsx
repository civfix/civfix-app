import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, webCursor, webTransition, webHover, focusRingProps } from "../theme"
import { BlurSurface } from "../surface"
import { HEADER_CONTROL_SIZE } from "./headerControls"

const SIZE = HEADER_CONTROL_SIZE

export interface GlassButtonProps {
  onPress: () => void
  children: React.ReactNode
  accessibilityLabel: string
  active?: boolean
  expanded?: boolean
  dot?: boolean
}

export function GlassButton({
  onPress,
  children,
  accessibilityLabel,
  active = false,
  expanded,
  dot = false,
}: GlassButtonProps) {
  const styles = useStyles()
  const t = useTheme()
  const solidFill = active
    ? { backgroundColor: t.glass.active.fill, borderColor: t.glass.active.fill }
    : null

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        hitSlop={6}
        {...focusRingProps}
        style={(state) => [
          styles.base,
          webTransition,
          webCursor(),
          t.shadows.s2,
          solidFill,
          webHover(state) ? styles.hovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        {!solidFill ? (
          <BlurSurface kind="button" style={[StyleSheet.absoluteFill, styles.noPointer]} />
        ) : null}

        <View style={styles.inner}>{children}</View>
      </Pressable>

      {dot ? <View style={[styles.dot, styles.noPointer]} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    width: SIZE,
    height: SIZE,
  },
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    overflow: "hidden",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  noPointer: {
    pointerEvents: "none",
  },
  hovered: {
    opacity: 0.94,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.colors.brand.bloom,
    borderWidth: 2,
    borderColor: t.colors.neutral.card,
  },
}))
