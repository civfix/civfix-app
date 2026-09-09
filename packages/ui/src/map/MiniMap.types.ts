/**
 * Shared contract for the MiniMap seam (UI-unification Stage 4 slice 5B-2).
 *
 * MiniMap is the small, non-interactive map embed at the top of a report / event detail body (design
 * `home.jsx` DetailMap + `.pi-detail-map`): the warm CARTO Voyager raster basemap centered on a single
 * coordinate, the focused teardrop pin planted on it (a category report teardrop, or - with no category
 * - the gold cleanup teardrop), an optional top-left tag pill, and a faint CARTO/OSM credit. Gestures
 * are disabled so the drag stays with the sheet; the camera is seeded once from lat/lng.
 *
 * It is its OWN .web/.native seam (NOT a thin wrapper over the full <Map/>): the full Map carries a
 * reconciling marker store, the nav-control chrome, and the viewport->bbox callback - none of which a
 * static single-pin embed needs. Both seams render the SHARED react-native-svg pins (TeardropPin /
 * EventPin), so the marker is pixel-identical to the home map; only the host (a maplibre-gl marker via
 * the createRoot pin bridge on web, a maplibre-react-native <Marker> on native) differs. maplibre stays
 * confined to the seam files (the import-guard reserves it for the .web / .native map seams).
 */
import type { CategoryColorKey } from "../theme"

export interface MiniMapProps {
  lat: number
  lng: number
  /** The teardrop color: a report category (category report teardrop) or, when omitted, the gold cleanup teardrop. */
  category?: CategoryColorKey | string
  /** Optional top-left tag pill (e.g. "YOU'RE GOING" / "EVENT" / a category label). */
  label?: string
  /** Map height (design `.pi-detail-map` = 150). Ignored when `aspectRatio` is set. */
  height?: number
  /**
   * Size the map by aspect ratio (width / height) instead of a fixed `height`. Lets a host keep a
   * CONSISTENT hero geometry across content variants - e.g. ReportDetailBody, whose hero is a 16:10
   * MediaPreview when the report has media and this map otherwise, passes the same 16/10 here so the hero
   * does not jump height between the two. When unset, the fixed `height` is used (the design default).
   */
  aspectRatio?: number
  /** Camera zoom; the design's static detail map uses 15. */
  zoom?: number
}

/** The default mini-map height (design `.pi-detail-map`), shared by both seams so the box geometry matches. */
export const MINIMAP_HEIGHT = 150
/** The default mini-map camera zoom (the design's static detail map). */
export const MINIMAP_ZOOM = 15
