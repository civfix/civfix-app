import type { Map as MlMap } from "maplibre-gl"
import { useLocationPick } from "./locationPickStore"

const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 10
const LONG_PRESS_DEDUPE_MS = 700

/** Getters, because the map is built once and every one of these changes while it lives. */
export interface PressGestureHandlers {
  pickActive: () => boolean
  expanded: () => boolean
  onPressMap: () => void
  longPressHandler: () => ((lat: number, lng: number) => void) | undefined
}

/** Returns the cancel for a pending touch long-press, for the map's teardown. */
export function attachPressGestures(map: MlMap, handlers: PressGestureHandlers): () => void {
  const blockedTarget = (target: EventTarget | null): boolean => {
    if (handlers.pickActive()) return true
    return target instanceof Element && target.closest(".maplibregl-marker") !== null
  }
  let lastFireAt = 0
  const fire = (lat: number, lng: number, target: EventTarget | null) => {
    const onLongPress = handlers.longPressHandler()
    if (!onLongPress) return
    if (blockedTarget(target)) return
    if (Date.now() - lastFireAt < LONG_PRESS_DEDUPE_MS) return
    lastFireAt = Date.now()
    onLongPress(lat, lng)
  }
  map.on("click", (e) => {
    if (handlers.pickActive()) {
      useLocationPick.getState().setDraft(e.lngLat.lat, e.lngLat.lng)
      return
    }
    handlers.onPressMap()
    if (handlers.expanded()) fire(e.lngLat.lat, e.lngLat.lng, e.originalEvent.target)
  })
  map.on("contextmenu", (e) => fire(e.lngLat.lat, e.lngLat.lng, e.originalEvent.target))

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let pressOrigin: { x: number; y: number } | null = null
  const cancelPress = () => {
    if (pressTimer !== null) clearTimeout(pressTimer)
    pressTimer = null
    pressOrigin = null
  }
  map.on("touchstart", (e) => {
    cancelPress()
    if (e.points.length !== 1) return
    pressOrigin = { x: e.point.x, y: e.point.y }
    const { lat, lng } = e.lngLat
    const target = e.originalEvent.target
    pressTimer = setTimeout(() => {
      pressTimer = null
      pressOrigin = null
      fire(lat, lng, target)
    }, LONG_PRESS_MS)
  })
  map.on("touchmove", (e) => {
    if (!pressOrigin) return
    if (Math.hypot(e.point.x - pressOrigin.x, e.point.y - pressOrigin.y) > LONG_PRESS_SLOP_PX) cancelPress()
  })
  map.on("touchend", cancelPress)
  map.on("touchcancel", cancelPress)
  return cancelPress
}
