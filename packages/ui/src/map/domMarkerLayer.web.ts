import type * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"

export interface MarkerEntry {
  marker: Marker
  root: Root
  signature: string
  onClick: { fn?: () => void }
}

export interface DesiredMarker {
  signature: string
  anchor: "bottom" | "center"
  lngLat: [number, number]
  node: React.ReactNode
  label: string
  onClick?: () => void
  /** Set only at creation, so a marker whose pressed state can change must carry it in its signature. */
  pressed?: boolean
  opacity?: number
}

/**
 * A marker whose signature is unchanged keeps its element and React root; only its position, name, opacity
 * and click target move, so a reconcile never remounts a pin that did not change.
 */
export function syncMarkers(
  map: MlMap,
  current: Map<string, MarkerEntry>,
  desired: ReadonlyMap<string, DesiredMarker>,
  beforePress?: () => void,
): void {
  for (const [key, entry] of current) {
    const want = desired.get(key)
    if (!want || want.signature !== entry.signature) {
      const stale = entry.root
      queueMicrotask(() => stale.unmount())
      entry.marker.remove()
      current.delete(key)
    } else {
      entry.marker.setLngLat(want.lngLat)
      entry.onClick.fn = want.onClick
      const el = entry.marker.getElement()
      el.setAttribute("aria-label", want.label)
      if (want.opacity !== undefined) el.style.opacity = String(want.opacity)
    }
  }
  for (const [key, want] of desired) {
    if (current.has(key)) continue
    const el = document.createElement("div")
    el.style.cursor = want.onClick ? "pointer" : "default"
    el.style.lineHeight = "0"
    if (want.opacity !== undefined) el.style.opacity = String(want.opacity)
    el.setAttribute("role", "button")
    el.setAttribute("tabindex", "0")
    if (want.pressed !== undefined) el.setAttribute("aria-pressed", String(want.pressed))
    const onClick: { fn?: () => void } = { fn: want.onClick }
    const press = () => {
      beforePress?.()
      onClick.fn?.()
    }
    el.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation()
      press()
    })
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      e.stopPropagation()
      press()
    })
    const root = createRoot(el)
    root.render(want.node)
    const marker = new maplibregl.Marker({ element: el, anchor: want.anchor })
      .setLngLat(want.lngLat)
      .addTo(map)
    // After addTo: maplibre's addTo overwrites aria-label with its generic "Map marker".
    el.setAttribute("aria-label", want.label)
    current.set(key, { marker, root, signature: want.signature, onClick })
  }
}

export function disposeMarkers(markers: Map<string, MarkerEntry>): void {
  for (const entry of markers.values()) {
    const r = entry.root
    queueMicrotask(() => r.unmount())
  }
  markers.clear()
}
