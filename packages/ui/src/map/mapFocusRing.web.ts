import { FOCUS_RING_COLOR, FOCUS_RING_OFFSET, FOCUS_RING_OUTLINE } from "../theme"

const MAP_FOCUS_STYLE_ID = "civfix-map-focus-ring"
const CANVAS_RING_INSET = -3
let mapFocusStyleInjected = false

export function ensureMapFocusRingStyle(): void {
  if (mapFocusStyleInjected || typeof document === "undefined") return
  mapFocusStyleInjected = true
  if (document.getElementById(MAP_FOCUS_STYLE_ID)) return
  const el = document.createElement("style")
  el.id = MAP_FOCUS_STYLE_ID
  el.textContent =
    `.cf-map-canvas canvas:focus-visible{outline:2px solid ${FOCUS_RING_COLOR};` +
    `outline-offset:${CANVAS_RING_INSET}px;}` +
    `.cf-map-canvas .maplibregl-ctrl button:focus-visible,` +
    `.cf-map-canvas .maplibregl-ctrl summary:focus-visible,` +
    `.cf-map-canvas .maplibregl-marker:focus-visible{` +
    `outline:${FOCUS_RING_OUTLINE};outline-offset:${FOCUS_RING_OFFSET}px;}`
  document.head.appendChild(el)
}
