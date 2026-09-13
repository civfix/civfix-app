export const LIGHTBOX_MIN_SCALE = 1

export const LIGHTBOX_MAX_SCALE = 4

export const LIGHTBOX_DOUBLE_TAP_SCALE = 2.5

export const LIGHTBOX_ZOOM_SNAP_SCALE = 1.05

export const LIGHTBOX_WHEEL_SCALE_PER_PIXEL = 0.0035

export interface ZoomTransform {
  scale: number
  x: number
  y: number
}

export const ZOOM_IDENTITY: ZoomTransform = Object.freeze({ scale: LIGHTBOX_MIN_SCALE, x: 0, y: 0 })

export interface ZoomGeometry {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
  maxScale: number
}

export interface ZoomSurface {
  surfaceWidth: number
  surfaceHeight: number
}

export interface ZoomPoint {
  x: number
  y: number
}

function finite(value: number, fallback: number): number {
  "worklet"
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampToLimit(value: number, limit: number): number {
  "worklet"
  const safe = finite(value, 0)
  const bound = Math.max(0, finite(limit, 0))
  const held = safe < -bound ? -bound : safe > bound ? bound : safe
  return held === 0 ? 0 : held
}

export function clampZoomScale(scale: number, maxScale: number = LIGHTBOX_MAX_SCALE): number {
  "worklet"
  const max = Math.max(LIGHTBOX_MIN_SCALE, finite(maxScale, LIGHTBOX_MAX_SCALE))
  const safe = finite(scale, LIGHTBOX_MIN_SCALE)
  if (safe < LIGHTBOX_MIN_SCALE) return LIGHTBOX_MIN_SCALE
  return safe > max ? max : safe
}

export function isZoomed(scale: number): boolean {
  "worklet"
  return finite(scale, LIGHTBOX_MIN_SCALE) > LIGHTBOX_ZOOM_SNAP_SCALE
}

export function zoomTranslationLimits(scale: number, geometry: ZoomGeometry): ZoomPoint {
  "worklet"
  const applied = clampZoomScale(scale, geometry.maxScale)
  const overflowX = finite(geometry.contentWidth, 0) * applied - finite(geometry.viewportWidth, 0)
  const overflowY = finite(geometry.contentHeight, 0) * applied - finite(geometry.viewportHeight, 0)
  return {
    x: overflowX > 0 ? overflowX / 2 : 0,
    y: overflowY > 0 ? overflowY / 2 : 0,
  }
}

export function clampZoomTransform(transform: ZoomTransform, geometry: ZoomGeometry): ZoomTransform {
  "worklet"
  const scale = clampZoomScale(transform.scale, geometry.maxScale)
  const limits = zoomTranslationLimits(scale, geometry)
  return { scale, x: clampToLimit(transform.x, limits.x), y: clampToLimit(transform.y, limits.y) }
}

export interface FocalZoomInput extends ZoomSurface {
  transform: ZoomTransform
  nextScale: number
  focalX: number
  focalY: number
  geometry: ZoomGeometry
}

export function focalZoomTransform(input: FocalZoomInput): ZoomTransform {
  "worklet"
  const geometry = input.geometry
  const fromScale = clampZoomScale(input.transform.scale, geometry.maxScale)
  const fromX = finite(input.transform.x, 0)
  const fromY = finite(input.transform.y, 0)
  const scale = clampZoomScale(input.nextScale, geometry.maxScale)
  const anchorX = finite(input.focalX, 0) - finite(input.surfaceWidth, 0) / 2
  const anchorY = finite(input.focalY, 0) - finite(input.surfaceHeight, 0) / 2
  const ratio = scale / fromScale
  return clampZoomTransform(
    { scale, x: anchorX - (anchorX - fromX) * ratio, y: anchorY - (anchorY - fromY) * ratio },
    geometry,
  )
}

export interface DoubleTapZoomInput extends ZoomSurface {
  transform: ZoomTransform
  focalX: number
  focalY: number
  geometry: ZoomGeometry
}

export function doubleTapZoomTransform(input: DoubleTapZoomInput): ZoomTransform {
  "worklet"
  if (isZoomed(input.transform.scale)) return ZOOM_IDENTITY
  return focalZoomTransform({
    transform: input.transform,
    nextScale: LIGHTBOX_DOUBLE_TAP_SCALE,
    focalX: input.focalX,
    focalY: input.focalY,
    surfaceWidth: input.surfaceWidth,
    surfaceHeight: input.surfaceHeight,
    geometry: input.geometry,
  })
}

export function panZoomTransform(
  start: ZoomTransform,
  translationX: number,
  translationY: number,
  geometry: ZoomGeometry,
): ZoomTransform {
  "worklet"
  return clampZoomTransform(
    {
      scale: start.scale,
      x: finite(start.x, 0) + finite(translationX, 0),
      y: finite(start.y, 0) + finite(translationY, 0),
    },
    geometry,
  )
}

export function settleZoomTransform(transform: ZoomTransform, geometry: ZoomGeometry): ZoomTransform {
  "worklet"
  if (!isZoomed(transform.scale)) return ZOOM_IDENTITY
  return clampZoomTransform(transform, geometry)
}

export function wheelZoomScale(
  scale: number,
  deltaY: number,
  maxScale: number = LIGHTBOX_MAX_SCALE,
): number {
  "worklet"
  const from = clampZoomScale(scale, maxScale)
  return clampZoomScale(from * Math.exp(-finite(deltaY, 0) * LIGHTBOX_WHEEL_SCALE_PER_PIXEL), maxScale)
}

export function travelExceeds(from: ZoomPoint, to: ZoomPoint, threshold: number): boolean {
  "worklet"
  const dx = finite(to.x, 0) - finite(from.x, 0)
  const dy = finite(to.y, 0) - finite(from.y, 0)
  const limit = Math.max(0, finite(threshold, 0))
  return dx * dx + dy * dy > limit * limit
}

export function pointerDistance(a: ZoomPoint, b: ZoomPoint): number {
  const dx = finite(b.x, 0) - finite(a.x, 0)
  const dy = finite(b.y, 0) - finite(a.y, 0)
  return Math.sqrt(dx * dx + dy * dy)
}

export function pointerMidpoint(a: ZoomPoint, b: ZoomPoint): ZoomPoint {
  return { x: (finite(a.x, 0) + finite(b.x, 0)) / 2, y: (finite(a.y, 0) + finite(b.y, 0)) / 2 }
}

export function cssZoomTransform(transform: ZoomTransform): string {
  const x = Math.round(finite(transform.x, 0) * 100) / 100
  const y = Math.round(finite(transform.y, 0) * 100) / 100
  const scale = Math.round(clampZoomScale(transform.scale, LIGHTBOX_MAX_SCALE) * 10000) / 10000
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`
}

export function zoomGeometry(input: {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
  maxScale?: number
}): ZoomGeometry {
  return {
    contentWidth: Math.max(0, finite(input.contentWidth, 0)),
    contentHeight: Math.max(0, finite(input.contentHeight, 0)),
    viewportWidth: Math.max(0, finite(input.viewportWidth, 0)),
    viewportHeight: Math.max(0, finite(input.viewportHeight, 0)),
    maxScale: clampZoomScale(input.maxScale ?? LIGHTBOX_MAX_SCALE, LIGHTBOX_MAX_SCALE),
  }
}
