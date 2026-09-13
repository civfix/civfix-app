import React, { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { motion } from "../theme"
import { timingConfig } from "../shell/motionConfigs.native"
import { useT } from "../i18n"
import {
  ZOOM_IDENTITY,
  clampZoomTransform,
  doubleTapZoomTransform,
  focalZoomTransform,
  isZoomed,
  panZoomTransform,
  settleZoomTransform,
  travelExceeds,
  zoomGeometry,
  type ZoomPoint,
  type ZoomTransform,
} from "./lightboxZoom"
import type { ZoomableMediaProps } from "./ZoomableMedia.types"

const SETTLE_CFG = timingConfig(motion.pageSwipeSettle)

const DOUBLE_TAP_MAX_TRAVEL = 40

const PAN_ACTIVATE_TRAVEL = 12

const DOUBLE_TAP_MAX_DELAY_MS = 300

export function ZoomableMedia({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  resetToken,
  maxScale,
  children,
}: ZoomableMediaProps) {
  const { t } = useT("lightbox")
  const [zoomed, setZoomed] = useState(false)

  const scale = useSharedValue(ZOOM_IDENTITY.scale)
  const x = useSharedValue(ZOOM_IDENTITY.x)
  const y = useSharedValue(ZOOM_IDENTITY.y)
  const pinchStart = useSharedValue<ZoomTransform>({ scale: 1, x: 0, y: 0 })
  const panStart = useSharedValue<ZoomTransform>({ scale: 1, x: 0, y: 0 })
  const panOrigin = useSharedValue<{ x: number; y: number }>({ x: 0, y: 0 })
  const panTouchOrigin = useSharedValue<ZoomPoint>({ x: 0, y: 0 })
  const surfaceWidth = useSharedValue(contentWidth)
  const surfaceHeight = useSharedValue(contentHeight)

  const geometry = useMemo(
    () => zoomGeometry({ contentWidth, contentHeight, viewportWidth, viewportHeight, maxScale }),
    [contentWidth, contentHeight, viewportWidth, viewportHeight, maxScale],
  )

  useEffect(() => {
    scale.value = ZOOM_IDENTITY.scale
    x.value = ZOOM_IDENTITY.x
    y.value = ZOOM_IDENTITY.y
    setZoomed(false)
  }, [resetToken, scale, x, y])

  useEffect(() => {
    const held = clampZoomTransform({ scale: scale.value, x: x.value, y: y.value }, geometry)
    scale.value = held.scale
    x.value = held.x
    y.value = held.y
    setZoomed(isZoomed(held.scale))
  }, [geometry, scale, x, y])

  const track = useCallback(
    (next: ZoomTransform) => {
      "worklet"
      scale.value = next.scale
      x.value = next.x
      y.value = next.y
    },
    [scale, x, y],
  )

  const commit = useCallback(
    (next: ZoomTransform) => {
      "worklet"
      const nextZoomed = isZoomed(next.scale)
      if (nextZoomed) runOnJS(setZoomed)(true)
      x.value = withTiming(next.x, SETTLE_CFG)
      y.value = withTiming(next.y, SETTLE_CFG)
      scale.value = withTiming(next.scale, SETTLE_CFG, (finished) => {
        if (finished && !nextZoomed) runOnJS(setZoomed)(false)
      })
    },
    [scale, x, y],
  )

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        pinchStart.value = { scale: scale.value, x: x.value, y: y.value }
      })
      .onUpdate((event) => {
        track(
          focalZoomTransform({
            transform: pinchStart.value,
            nextScale: pinchStart.value.scale * event.scale,
            focalX: event.focalX,
            focalY: event.focalY,
            surfaceWidth: surfaceWidth.value,
            surfaceHeight: surfaceHeight.value,
            geometry,
          }),
        )
      })
      .onEnd(() => {
        commit(settleZoomTransform({ scale: scale.value, x: x.value, y: y.value }, geometry))
      })

    const pan = Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((event) => {
        const touch = event.allTouches[0]
        if (touch) panTouchOrigin.value = { x: touch.absoluteX, y: touch.absoluteY }
      })
      .onTouchesMove((event, manager) => {
        if (!isZoomed(scale.value)) {
          manager.fail()
          return
        }
        if (event.numberOfTouches > 1) return
        const touch = event.allTouches[0]
        if (!touch) return
        if (!travelExceeds(panTouchOrigin.value, { x: touch.absoluteX, y: touch.absoluteY }, PAN_ACTIVATE_TRAVEL)) {
          return
        }
        manager.activate()
      })
      .onStart((event) => {
        panStart.value = { scale: scale.value, x: x.value, y: y.value }
        panOrigin.value = { x: event.translationX, y: event.translationY }
      })
      .onUpdate((event) => {
        track(
          panZoomTransform(
            panStart.value,
            event.translationX - panOrigin.value.x,
            event.translationY - panOrigin.value.y,
            geometry,
          ),
        )
      })
      .onEnd(() => {
        commit(settleZoomTransform({ scale: scale.value, x: x.value, y: y.value }, geometry))
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(DOUBLE_TAP_MAX_TRAVEL)
      .maxDelay(DOUBLE_TAP_MAX_DELAY_MS)
      .onEnd((event, success) => {
        if (!success) return
        commit(
          doubleTapZoomTransform({
            transform: { scale: scale.value, x: x.value, y: y.value },
            focalX: event.x,
            focalY: event.y,
            surfaceWidth: surfaceWidth.value,
            surfaceHeight: surfaceHeight.value,
            geometry,
          }),
        )
      })

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))
  }, [
    commit,
    geometry,
    panOrigin,
    panStart,
    panTouchOrigin,
    pinchStart,
    scale,
    surfaceHeight,
    surfaceWidth,
    track,
    x,
    y,
  ])

  const onSurfaceLayout = useCallback(
    (event: LayoutChangeEvent) => {
      surfaceWidth.value = event.nativeEvent.layout.width
      surfaceHeight.value = event.nativeEvent.layout.height
    },
    [surfaceHeight, surfaceWidth],
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  const surfaceStyle = zoomed ? styles.surfaceZoomed : styles.surface

  return (
    <View style={styles.viewport} pointerEvents="box-none">
      <GestureHandlerRootView style={surfaceStyle}>
        <GestureDetector gesture={gesture}>
          <View
            style={surfaceStyle}
            onLayout={onSurfaceLayout}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("control.zoom_label")}
            accessibilityHint={t("control.zoom_hint")}
          >
            <Animated.View
              style={[{ width: contentWidth, height: contentHeight }, animatedStyle]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {children}
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  surface: {
    alignItems: "center",
    justifyContent: "center",
  },
  surfaceZoomed: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
})
