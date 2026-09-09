import React, { memo, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { BlurView } from "expo-blur"
import { Canvas, Fill, Shader } from "@shopify/react-native-skia"
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from "react-native-reanimated"
import { makeThemedStyles, useTheme, supportsBlur, type Theme } from "../../theme"
import {
  DOCK_H,
  DOCK_MORPH_SHRINK,
  dockShapes,
  dockRadius,
  morphK,
  morphUniforms,
  parseRgba,
  type DockShapes,
  type Rect,
} from "./liquidGlassModel"
import { makeLiquidGlassEffect } from "./glassShaders"
import type { LiquidGlassDockProps } from "./LiquidGlassDock.types"

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

function frameStyle(f: Rect) {
  "worklet"
  return {
    left: f.x,
    top: f.y,
    width: f.width,
    height: f.height,
  }
}

const CLEAR_BASE = DOCK_H - DOCK_MORPH_SHRINK

function clipStyle() {
  return {
    ...StyleSheet.absoluteFillObject,
    borderRadius: dockRadius(),
    overflow: "hidden" as const,
  }
}

function dockShadowStyle(t: Theme) {
  const shadow = t.glass.dock.shadow
  return {
    shadowColor: shadow.color,
    shadowOffset: { width: 0, height: shadow.offsetY },
    shadowRadius: shadow.radius,
    shadowOpacity: 1,
  }
}

function dockColorUniforms(t: Theme) {
  const spec = t.glass.dock
  return {
    tint: parseRgba(spec.fill),
    borderColor: parseRgba(spec.border),
    sheenColor: parseRgba(spec.sheen),
  }
}

type DockGlassLayersProps = Pick<
  LiquidGlassDockProps,
  "regionW" | "progress" | "focus" | "minimize" | "shapes"
>

const DockGlassLayers = memo(function DockGlassLayers({
  regionW,
  progress,
  focus,
  minimize,
  shapes,
}: DockGlassLayersProps) {
  const t = useTheme()
  const styles = useStyles()
  const spec = t.glass.dock
  const blurTint = t.scheme === "dark" ? "dark" : "light"
  const shadowStyle = useMemo(() => dockShadowStyle(t), [t])
  const colorUniforms = useMemo(() => dockColorUniforms(t), [t])
  const effect = useMemo(() => makeLiquidGlassEffect(), [])
  const zeroFocus = useSharedValue(0)
  const focusV = focus ?? zeroFocus
  const zeroMinimize = useSharedValue(0)
  const minimizeV = minimize ?? zeroMinimize

  const localShapes = useDerivedValue<DockShapes>(
    () =>
      shapes !== undefined
        ? shapes.value
        : dockShapes(progress.value, regionW, focusV.value, minimizeV.value),
    [regionW, shapes],
  )
  const shapesV = shapes ?? localShapes

  const uniforms = useDerivedValue(() => {
    const s = shapesV.value
    const sheenHalf = s.left.height / 2
    const sheenCY = s.left.y + sheenHalf
    return {
      ...morphUniforms(s, dockRadius(), morphK(progress.value)),
      sheenCY,
      sheenHalf,
      ...colorUniforms,
    }
  }, [colorUniforms])

  const leftStyle = useAnimatedStyle(() => frameStyle(shapesV.value.left))
  const rightStyle = useAnimatedStyle(() => frameStyle(shapesV.value.right))
  const clearStyle = useAnimatedStyle(() => {
    const f = shapesV.value.clear
    return {
      opacity: focusV.value,
      transform: [
        { translateX: f.x + f.width / 2 - CLEAR_BASE / 2 },
        { translateY: f.y + f.height / 2 - CLEAR_BASE / 2 },
        { scale: f.width / CLEAR_BASE },
      ],
    }
  })
  const clip = useMemo(() => clipStyle(), [])

  const leftBlurStyle = useAnimatedStyle(() => {
    const f = shapesV.value.left
    return { transform: [{ translateX: -f.x }, { translateY: -f.y }] }
  })
  const rightBlurStyle = useAnimatedStyle(() => {
    const f = shapesV.value.right
    return { transform: [{ translateX: -f.x }, { translateY: -f.y }] }
  })
  const frozenBlurFrame = useMemo(
    () => ({ position: "absolute" as const, top: 0, left: 0, width: regionW, height: DOCK_H }),
    [regionW],
  )

  return (
    <View style={[StyleSheet.absoluteFill, styles.noPointer]}>
      {supportsBlur ? (
        <>
          <Animated.View style={[styles.shapeFrame, leftStyle, shadowStyle]}>
            <View style={clip}>
              <AnimatedBlurView
                intensity={spec.blurIntensity}
                tint={blurTint}
                style={[frozenBlurFrame, leftBlurStyle]}
              />
            </View>
            <View style={[clip, styles.creamFill]} />
          </Animated.View>
          <Animated.View style={[styles.shapeFrame, rightStyle, shadowStyle]}>
            <View style={clip}>
              <AnimatedBlurView
                intensity={spec.blurIntensity}
                tint={blurTint}
                style={[frozenBlurFrame, rightBlurStyle]}
              />
            </View>
            <View style={[clip, styles.creamFill]} />
          </Animated.View>
          <Animated.View style={[styles.clearFrame, shadowStyle, clearStyle]}>
            <AnimatedBlurView intensity={spec.blurIntensity} tint={blurTint} style={clip} />
            <View style={[clip, styles.creamFill]} />
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View style={[styles.shapeFrame, leftStyle, shadowStyle]}>
            <View style={[clip, { backgroundColor: spec.fillFallback }]} />
          </Animated.View>
          <Animated.View style={[styles.shapeFrame, rightStyle, shadowStyle]}>
            <View style={[clip, { backgroundColor: spec.fillFallback }]} />
          </Animated.View>
          <Animated.View style={[styles.clearFrame, shadowStyle, clearStyle]}>
            <View style={[clip, { backgroundColor: spec.fillFallback }]} />
          </Animated.View>
        </>
      )}
      <Canvas style={[StyleSheet.absoluteFill, styles.noPointer]}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  )
})

export function LiquidGlassDock({
  regionW,
  progress,
  focus,
  minimize,
  shapes,
  children,
  style,
}: LiquidGlassDockProps) {
  return (
    <View style={style}>
      <DockGlassLayers
        regionW={regionW}
        progress={progress}
        focus={focus}
        minimize={minimize}
        shapes={shapes}
      />
      {children}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  noPointer: {
    pointerEvents: "none",
  },
  shapeFrame: {
    position: "absolute",
    borderRadius: dockRadius(),
  },
  clearFrame: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CLEAR_BASE,
    height: CLEAR_BASE,
    borderRadius: CLEAR_BASE / 2,
  },
  creamFill: {
    backgroundColor: t.glass.dock.fill,
  },
}))
