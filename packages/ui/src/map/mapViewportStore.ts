/**
 * Lets AddressSearch bias Photon suggestions toward the area visible on the main map. The seams clear it on
 * unmount so a later flow does not bias to a stale view; with no map mounted AddressSearch falls back to
 * its device then IP chain.
 *
 * The center is the bbox midpoint, which is the true center only because both seams disable the rotate
 * and pitch gestures.
 */
import { create } from "zustand"
import type { BBox } from "@civfix/shared"

export interface MapViewport {
  center: { lat: number; lng: number }
  zoom: number
  bbox: BBox
}

export interface MapViewportState {
  viewport: MapViewport | null
  setRegion: (bbox: BBox, zoom: number) => void
  clear: () => void
}

function bboxCenter(bbox: BBox): { lat: number; lng: number } {
  return { lat: (bbox.north + bbox.south) / 2, lng: (bbox.west + bbox.east) / 2 }
}

export interface ViewportBias {
  proximity: { lat: number; lng: number }
  proximityZoom: number
  locationBiasScale: number
}

/** Photon's `zoom` is a coarse radius, so the live zoom is rounded. */
export function viewportBias(viewport: MapViewport | null, locationBiasScale: number): ViewportBias | null {
  if (!viewport) return null
  return { proximity: viewport.center, proximityZoom: Math.round(viewport.zoom), locationBiasScale }
}

export const useMapViewport = create<MapViewportState>((set) => ({
  viewport: null,
  setRegion: (bbox, zoom) => set({ viewport: { center: bboxCenter(bbox), zoom, bbox } }),
  clear: () => set({ viewport: null }),
}))
