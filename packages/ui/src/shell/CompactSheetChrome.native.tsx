import React from "react"
import { View, Pressable, StyleSheet, Platform } from "react-native"
import { useBottomSheetInternal, type BottomSheetBackgroundProps } from "@gorhom/bottom-sheet"
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from "react-native-reanimated"
import { BlurView } from "expo-blur"
import { makeThemedStyles, useTheme } from "../theme"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import { SHEET_SNAP_RANGE, sheetSnapValueKey } from "./tabBarLogic"
import {
  SHEET_FLOAT_BOTTOM,
  SHEET_FLOAT_RADIUS,
  SHEET_FLOAT_SIDE,
  SHEET_HANDLE_BAR,
  SHEET_HANDLE_HEIGHT,
} from "./sheetChrome"

const useBlur = Platform.OS === "ios"
const AnimatedBlur = Animated.createAnimatedComponent(BlurView)

const ADJUST_ACTIONS = [{ name: "increment" }, { name: "decrement" }]

// Its own component so the live snap value re-renders only the handle: a new
// handleComponent identity would remount it and drop screen-reader focus mid-adjust.
export function SheetGrabHandle({
  label,
  onCycle,
  onAdjust,
}: {
  label: string
  onCycle: () => void
  onAdjust: (actionName: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("nav")
  const snap = useNavStore((s) => s.snap)
  return (
    <Pressable
      onPress={onCycle}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ ...SHEET_SNAP_RANGE, now: snap, text: t(sheetSnapValueKey(snap)) }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(e) => onAdjust(e.nativeEvent.actionName)}
      style={styles.handleArea}
    >
      <View style={styles.handleBar} />
    </Pressable>
  )
}

export function makeBackground(
  animatedIndex: SharedValue<number>,
  animatedPosition: SharedValue<number>,
  screenH: number,
) {
  return function GlassBackground({ style }: BottomSheetBackgroundProps) {
    const styles = useStyles()
    const th = useTheme()
    // gorhom's measured container height is where the sheet bottoms in animatedPosition's space.
    // useWindowDimensions under-reports it by varying system-bar amounts on Android edge-to-edge.
    const { animatedLayoutState } = useBottomSheetInternal()
    // No overflow:hidden on the shadow wrapper: iOS masksToBounds would eat the shadow, so a clip child
    // masks the blur/wash/sheen instead.
    const cardStyle = useAnimatedStyle(() => {
      const i = animatedIndex.value
      const side = interpolate(i, [0, 2], SHEET_FLOAT_SIDE, Extrapolation.CLAMP)
      const gap = interpolate(i, [0, 2], SHEET_FLOAT_BOTTOM, Extrapolation.CLAMP)
      const radius = interpolate(i, [0, 2], SHEET_FLOAT_RADIUS, Extrapolation.CLAMP)
      // rawContainerHeight is -999 until laid out, so the first frame falls back to the window height.
      const rawH = animatedLayoutState.value.rawContainerHeight
      const sheetBottom = rawH > 0 ? rawH : screenH
      const cardH = Math.max(sheetBottom - animatedPosition.value - gap, 0)
      return {
        left: side,
        right: side,
        height: cardH,
        // Rounded top only: rounding the flush bottom edge would open background slivers at the corners.
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    })
    const radiusStyle = useAnimatedStyle(() => {
      const radius = interpolate(animatedIndex.value, [0, 2], SHEET_FLOAT_RADIUS, Extrapolation.CLAMP)
      return {
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    })
    return (
      <Animated.View style={[style, styles.bgRoot]}>
        <Animated.View style={[styles.cardShadow, cardStyle]}>
          <Animated.View style={[styles.cardClip, radiusStyle]}>
            {useBlur ? (
              <AnimatedBlur intensity={th.glass.sheet.blurIntensity} tint={th.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={styles.cardWash} />
            <View style={styles.cardSheen} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    )
  }
}

const useStyles = makeThemedStyles((t) => ({
  bgRoot: {
    backgroundColor: "transparent",
    pointerEvents: "none",
  },
  // An opaque fill so the shadow casts on iOS.
  cardShadow: {
    position: "absolute",
    top: 0,
    backgroundColor: t.glass.sheet.fillFallback,
    ...t.shadows.s4,
  },
  cardClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  cardWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: useBlur ? t.glass.sheet.fill : "transparent",
  },
  cardSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: t.glass.sheet.sheen,
  },
  handleArea: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: t.space["2"],
  },
  handleBar: {
    ...SHEET_HANDLE_BAR,
    backgroundColor: t.glass.grabHandle,
  },
}))
