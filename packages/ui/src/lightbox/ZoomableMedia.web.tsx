import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { EASE_STANDARD_CSS, motion, webNoSelect } from "../theme"
import { useT } from "../i18n"
import {
  ZOOM_IDENTITY,
  clampZoomTransform,
  cssZoomTransform,
  doubleTapZoomTransform,
  focalZoomTransform,
  isZoomed,
  panZoomTransform,
  pointerDistance,
  pointerMidpoint,
  settleZoomTransform,
  wheelZoomScale,
  zoomGeometry,
  type ZoomPoint,
  type ZoomTransform,
} from "./lightboxZoom"
import type { ZoomableMediaProps } from "./ZoomableMedia.types"

const WHEEL_LINE_HEIGHT_PX = 16

const WHEEL_SETTLE_DELAY_MS = 160

const SETTLE_MS = motion.pageSwipeSettle.duration

const surfaceStyle = {
  alignItems: "center",
  justifyContent: "center",
  touchAction: "none",
  cursor: "zoom-in",
} as unknown as ViewStyle

const surfaceZoomedStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: "center",
  justifyContent: "center",
  touchAction: "none",
  cursor: "grab",
} as unknown as ViewStyle

const viewportStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: "center",
  justifyContent: "center",
} as unknown as ViewStyle

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
  const [surface, setSurface] = useState<HTMLElement | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const contentRef = useRef<HTMLElement | null>(null)
  const transformRef = useRef<ZoomTransform>(ZOOM_IDENTITY)
  const unzoomTimer = useRef<number | null>(null)

  const geometry = useMemo(
    () => zoomGeometry({ contentWidth, contentHeight, viewportWidth, viewportHeight, maxScale }),
    [contentWidth, contentHeight, viewportWidth, viewportHeight, maxScale],
  )
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry

  const setSurfaceNode = useCallback((node: unknown) => {
    setSurface((node ?? null) as HTMLElement | null)
  }, [])

  const setContentNode = useCallback((node: unknown) => {
    contentRef.current = (node ?? null) as HTMLElement | null
  }, [])

  const clearUnzoomTimer = useCallback(() => {
    if (typeof window === "undefined") return
    if (unzoomTimer.current === null) return
    window.clearTimeout(unzoomTimer.current)
    unzoomTimer.current = null
  }, [])

  const apply = useCallback(
    (next: ZoomTransform, animated = false) => {
      transformRef.current = next
      const node = contentRef.current
      if (node) {
        node.style.transitionProperty = animated ? "transform" : "none"
        node.style.transitionDuration = `${SETTLE_MS}ms`
        node.style.transitionTimingFunction = EASE_STANDARD_CSS
        node.style.transform = cssZoomTransform(next)
      }
      clearUnzoomTimer()
      if (isZoomed(next.scale)) {
        setZoomed(true)
        return
      }
      if (!animated || typeof window === "undefined") {
        setZoomed(false)
        return
      }
      unzoomTimer.current = window.setTimeout(() => {
        unzoomTimer.current = null
        setZoomed(false)
      }, SETTLE_MS)
    },
    [clearUnzoomTimer],
  )

  useEffect(() => clearUnzoomTimer, [clearUnzoomTimer])

  useEffect(() => {
    apply(ZOOM_IDENTITY)
  }, [apply, resetToken])

  useEffect(() => {
    apply(clampZoomTransform(transformRef.current, geometry))
  }, [apply, geometry])

  useEffect(() => {
    if (!surface) return
    const pointers = new Map<number, ZoomPoint>()
    let rect = surface.getBoundingClientRect()
    let pinchStart: { transform: ZoomTransform; distance: number } | null = null
    let dragStart: { transform: ZoomTransform; point: ZoomPoint } | null = null
    let wheelSettle: number | null = null

    const local = (event: { clientX: number; clientY: number }): ZoomPoint => ({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })

    const pair = (): [ZoomPoint, ZoomPoint] | null => {
      const live = Array.from(pointers.values())
      const first = live[0]
      const second = live[1]
      return first && second ? [first, second] : null
    }

    const settle = () => {
      apply(settleZoomTransform(transformRef.current, geometryRef.current), true)
    }

    const cancelWheelSettle = () => {
      if (wheelSettle === null) return
      window.clearTimeout(wheelSettle)
      wheelSettle = null
    }

    const onPointerDown = (event: PointerEvent) => {
      cancelWheelSettle()
      if (pointers.size === 0) rect = surface.getBoundingClientRect()
      pointers.set(event.pointerId, local(event))
      if (typeof surface.setPointerCapture === "function") surface.setPointerCapture(event.pointerId)
      const two = pair()
      if (two) {
        pinchStart = {
          transform: transformRef.current,
          distance: Math.max(1, pointerDistance(two[0], two[1])),
        }
        dragStart = null
        return
      }
      dragStart = { transform: transformRef.current, point: local(event) }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, local(event))
      const two = pair()
      if (two && pinchStart) {
        const spread = pointerDistance(two[0], two[1])
        const focal = pointerMidpoint(two[0], two[1])
        apply(
          focalZoomTransform({
            transform: pinchStart.transform,
            nextScale: pinchStart.transform.scale * (spread / pinchStart.distance),
            focalX: focal.x,
            focalY: focal.y,
            surfaceWidth: rect.width,
            surfaceHeight: rect.height,
            geometry: geometryRef.current,
          }),
        )
        return
      }
      if (!dragStart || !isZoomed(transformRef.current.scale)) return
      const point = local(event)
      apply(
        panZoomTransform(
          dragStart.transform,
          point.x - dragStart.point.x,
          point.y - dragStart.point.y,
          geometryRef.current,
        ),
      )
    }

    const onPointerEnd = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (pointers.size < 2) pinchStart = null
      const remaining = Array.from(pointers.values())[0]
      if (remaining) {
        dragStart = { transform: transformRef.current, point: remaining }
        return
      }
      dragStart = null
      settle()
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelWheelSettle()
      if (pointers.size === 0) rect = surface.getBoundingClientRect()
      const step =
        event.deltaMode === 1
          ? event.deltaY * WHEEL_LINE_HEIGHT_PX
          : event.deltaMode === 2
            ? event.deltaY * rect.height
            : event.deltaY
      const current = transformRef.current
      const point = local(event)
      apply(
        focalZoomTransform({
          transform: current,
          nextScale: wheelZoomScale(current.scale, step, geometryRef.current.maxScale),
          focalX: point.x,
          focalY: point.y,
          surfaceWidth: rect.width,
          surfaceHeight: rect.height,
          geometry: geometryRef.current,
        }),
      )
      wheelSettle = window.setTimeout(() => {
        wheelSettle = null
        settle()
      }, WHEEL_SETTLE_DELAY_MS)
    }

    const onDoubleClick = (event: MouseEvent) => {
      event.preventDefault()
      cancelWheelSettle()
      rect = surface.getBoundingClientRect()
      const point = local(event)
      apply(
        doubleTapZoomTransform({
          transform: transformRef.current,
          focalX: point.x,
          focalY: point.y,
          surfaceWidth: rect.width,
          surfaceHeight: rect.height,
          geometry: geometryRef.current,
        }),
        true,
      )
    }

    const onDragStart = (event: Event) => {
      event.preventDefault()
    }

    surface.addEventListener("pointerdown", onPointerDown)
    surface.addEventListener("pointermove", onPointerMove)
    surface.addEventListener("pointerup", onPointerEnd)
    surface.addEventListener("pointercancel", onPointerEnd)
    surface.addEventListener("wheel", onWheel, { passive: false })
    surface.addEventListener("dblclick", onDoubleClick)
    surface.addEventListener("dragstart", onDragStart)
    window.addEventListener("pointerup", onPointerEnd)
    window.addEventListener("pointercancel", onPointerEnd)
    return () => {
      cancelWheelSettle()
      surface.removeEventListener("pointerdown", onPointerDown)
      surface.removeEventListener("pointermove", onPointerMove)
      surface.removeEventListener("pointerup", onPointerEnd)
      surface.removeEventListener("pointercancel", onPointerEnd)
      surface.removeEventListener("wheel", onWheel)
      surface.removeEventListener("dblclick", onDoubleClick)
      surface.removeEventListener("dragstart", onDragStart)
      window.removeEventListener("pointerup", onPointerEnd)
      window.removeEventListener("pointercancel", onPointerEnd)
    }
  }, [apply, surface])

  return (
    <View style={viewportStyle} pointerEvents="box-none">
      <View
        ref={setSurfaceNode}
        style={[zoomed ? surfaceZoomedStyle : surfaceStyle, webNoSelect]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("control.zoom_label")}
        accessibilityHint={t("control.zoom_hint_pointer")}
      >
        <View ref={setContentNode} style={{ width: contentWidth, height: contentHeight }}>
          {children}
        </View>
      </View>
    </View>
  )
}
