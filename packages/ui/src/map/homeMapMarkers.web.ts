import type * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"
import { useMapFlyTo } from "./mapFlyToStore"

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
}

/**
 * A marker whose signature is unchanged keeps its element and React root; only its position, name and
 * click target move, so a reconcile never remounts a pin that did not change.
 */
export function syncMarkers(
  map: MlMap,
  current: Map<string, MarkerEntry>,
  desired: ReadonlyMap<string, DesiredMarker>,
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
      entry.marker.getElement().setAttribute("aria-label", want.label)
      entry.onClick.fn = want.onClick
    }
  }
  for (const [key, want] of desired) {
    if (current.has(key)) continue
    const el = document.createElement("div")
    el.style.cursor = want.onClick ? "pointer" : "default"
    el.style.lineHeight = "0"
    el.setAttribute("role", "button")
    el.setAttribute("tabindex", "0")
    const onClick: { fn?: () => void } = { fn: want.onClick }
    el.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation()
      useMapFlyTo.getState().clear()
      onClick.fn?.()
    })
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      e.stopPropagation()
      useMapFlyTo.getState().clear()
      onClick.fn?.()
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
