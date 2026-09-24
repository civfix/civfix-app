import type * as React from "react"
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl"
import { createRoot, type Root } from "react-dom/client"

export interface MarkerEntry {
  marker: Marker
  root: Root
  signature: string
  anchor: DesiredMarker["anchor"]
  onClick: { fn?: () => void }
}

export interface DesiredMarker {
  signature: string
  anchor: "bottom" | "center"
  lngLat: [number, number]
  node: React.ReactNode
  label: string
  onClick?: () => void
  /** Re-applied only when the signature changes, so a marker whose pressed state can change must carry it there. */
  pressed?: boolean
  opacity?: number
}

/**
 * A marker whose key and anchor are unchanged keeps its element, maplibre Marker and React root; only its
 * position, name, opacity and click target move, and a changed signature re-renders into the same root instead
 * of rebuilding the element, so a scheme switch or an active toggle creates no DOM nodes or roots.
 */
export function syncMarkers(
  map: MlMap,
  current: Map<string, MarkerEntry>,
  desired: ReadonlyMap<string, DesiredMarker>,
  beforePress?: () => void,
): void {
  const restack = new Set<string>()
  for (const [key, entry] of current) {
    const want = desired.get(key)
    if (!want || want.anchor !== entry.anchor) {
      const stale = entry.root
      queueMicrotask(() => stale.unmount())
      entry.marker.remove()
      current.delete(key)
      continue
    }
    entry.marker.setLngLat(want.lngLat)
    entry.onClick.fn = want.onClick
    const el = entry.marker.getElement()
    el.setAttribute("aria-label", want.label)
    if (want.opacity !== undefined) el.style.opacity = String(want.opacity)
    if (want.signature !== entry.signature) {
      entry.signature = want.signature
      el.style.cursor = want.onClick ? "pointer" : "default"
      if (want.pressed !== undefined) el.setAttribute("aria-pressed", String(want.pressed))
      else el.removeAttribute("aria-pressed")
      entry.root.render(want.node)
      restack.add(key)
    }
  }
  for (const [key, want] of desired) {
    const kept = current.get(key)
    if (kept) {
      // DOM order is the marker stacking order: a re-rendered pin moves to the end, where a rebuilt one used to
      // land, so a newly active pin still draws over its neighbours.
      if (restack.has(key)) {
        const el = kept.marker.getElement()
        el.parentNode?.appendChild(el)
      }
      continue
    }
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
    current.set(key, { marker, root, signature: want.signature, anchor: want.anchor, onClick })
  }
}

export function disposeMarkers(markers: Map<string, MarkerEntry>): void {
  for (const entry of markers.values()) {
    const r = entry.root
    queueMicrotask(() => r.unmount())
  }
  markers.clear()
}
