/**
 * The shared "where is the MAIN map currently looking" bus.
 *
 * Address autocomplete should favor the area the user is actually looking at on the map, not just where
 * their device happens to be. But the search input (AddressSearch, deep inside the host/report forms) is
 * decoupled from the persistent <Map/>. This tiny zustand store bridges them without either importing the
 * app (mirrors mapFocusStore / locationPickStore):
 *   - the shared <Map/> (.web + .native seams) PUBLISHES its region (`setRegion`) on every move-settle, and
 *     CLEARS it on unmount so a later flow does not bias to a stale view;
 *   - AddressSearch READS the latest viewport at search time and passes its center (+ zoom) as the Photon
 *     proximity bias, so suggestions lean toward the visible map.
 *
 * The center is the bbox midpoint (the maps disable rotation, so the rendered bounds are axis-aligned and
 * the midpoint is the true center). When no map is mounted (a cold deep-link, or the mobile flow opened
 * without the home map) the store stays null and AddressSearch falls back to its device -> IP chain.
 *
 * Pure zustand (mirrors mapFocusStore.ts) - no next / expo / react-native / maplibre - so it unit-tests
 * directly and both seam files (.web map + .native map) plus the shared body may import it.
 */
import { create } from "zustand"
import type { BBox } from "@civfix/shared"

/** The main map's last-settled view: its bounds, the live zoom, and the derived center (bbox midpoint). */
export interface MapViewport {
  center: { lat: number; lng: number }
  zoom: number
  bbox: BBox
}

export interface MapViewportState {
  /** The last region the main map settled on, or null when no map is mounted / has reported yet. */
  viewport: MapViewport | null
  /** Publish the current region (the Map seams call this from their move-settle handler). */
  setRegion: (bbox: BBox, zoom: number) => void
  /** Clear the published viewport (the Map seam calls this on unmount). */
  clear: () => void
}

/** The center of a bounds rectangle (axis-aligned: the maps disable rotation, so this is the true center). */
function bboxCenter(bbox: BBox): { lat: number; lng: number } {
  return { lat: (bbox.north + bbox.south) / 2, lng: (bbox.west + bbox.east) / 2 }
}

/** The Photon location-bias options derived from a map view (center focus, live zoom, tuned scale). */
export interface ViewportBias {
  proximity: { lat: number; lng: number }
  proximityZoom: number
  locationBiasScale: number
}

/**
 * The Photon location-bias for the current map view: its center as the focus, the live zoom as the focus
 * radius (rounded - Photon's `zoom` is a coarse radius), and the caller's bias scale. Returns null when no
 * map is mounted, so the caller (AddressSearch) falls back to its own device -> IP fix. Pure, so it unit-tests
 * directly and keeps the component thin.
 */
export function viewportBias(viewport: MapViewport | null, locationBiasScale: number): ViewportBias | null {
  if (!viewport) return null
  return { proximity: viewport.center, proximityZoom: Math.round(viewport.zoom), locationBiasScale }
}

export const useMapViewport = create<MapViewportState>((set) => ({
  viewport: null,
  setRegion: (bbox, zoom) => set({ viewport: { center: bboxCenter(bbox), zoom, bbox } }),
  clear: () => set({ viewport: null }),
}))
