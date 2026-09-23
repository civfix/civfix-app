import type { BBox } from "@civfix/shared"

/**
 * Clustering is client-side, so the map fetches raw points for a padded region and reclusters locally,
 * refetching only when the viewport nears a loaded edge (EDGE_MARGIN) or the region gets too coarse for
 * the <=2000-candidate sample (MAX_COARSENESS). The server switches from grid aggregates to pins at
 * SERVER_PIN_ZOOM, derived from the fetch bbox alone, so crossing that threshold forces a refetch even
 * inside a held region; otherwise stale aggregates would linger for a whole zoom level.
 */
export const PAD_FACTOR = 0.6
export const EDGE_MARGIN = 0.12
export const MAX_COARSENESS = 3.5
export const SERVER_PIN_ZOOM = 10
export const VIEWPORT_REFERENCE_TILES = 8

/** Same derivation and reference viewport as the server's bbox-to-zoom clamp. */
export function impliedZoomForBBox(b: BBox): number {
  const span = Math.max(b.east - b.west, (b.north - b.south) * 2)
  if (!Number.isFinite(span) || span <= 0) return 0
  const zoom = Math.log2((360 * VIEWPORT_REFERENCE_TILES) / span)
  if (!Number.isFinite(zoom)) return 0
  return Math.max(0, Math.min(22, Math.floor(zoom)))
}

export function serverReturnsPins(region: BBox): boolean {
  return impliedZoomForBBox(region) >= SERVER_PIN_ZOOM
}

function crossesIntoServerPins(held: BBox, fresh: BBox): boolean {
  return serverReturnsPins(fresh) && !serverReturnsPins(held)
}

export function padBbox(b: BBox, factor: number): BBox {
  const dw = ((b.east - b.west) * factor) / 2
  const dh = ((b.north - b.south) * factor) / 2
  return { west: b.west - dw, south: b.south - dh, east: b.east + dw, north: b.north + dh }
}

export function regionCovers(loaded: BBox, viewport: BBox): boolean {
  const lw = loaded.east - loaded.west
  const lh = loaded.north - loaded.south
  const inside =
    viewport.west >= loaded.west + lw * EDGE_MARGIN &&
    viewport.east <= loaded.east - lw * EDGE_MARGIN &&
    viewport.south >= loaded.south + lh * EDGE_MARGIN &&
    viewport.north <= loaded.north - lh * EDGE_MARGIN
  const fineEnough = lw <= (viewport.east - viewport.west) * MAX_COARSENESS
  return inside && fineEnough
}

/**
 * `requested` alone cannot survive a failed fetch, and `loaded` alone cannot dedupe the settles that
 * arrive while its successor is still in flight.
 */
export type RegionFetchState = {
  loaded: BBox | null
  requested: BBox | null
}

/**
 * "revert" re-points the query at the held (cached) region when the viewport moves back inside it while
 * a far-away region is in flight, so the map repaints instantly instead of swapping in the wrong pins.
 */
export type RegionFetchDecision =
  | { action: "keep" }
  | { action: "revert"; region: BBox }
  | { action: "request"; region: BBox }

/**
 * `requested` is checked before `loaded` because its points are the ones that will land; checking
 * `loaded` first would restart the request on every settle of a long pan.
 */
export function decideRegionFetch(
  state: RegionFetchState,
  viewport: BBox,
  padFactor: number = PAD_FACTOR,
): RegionFetchDecision {
  const { loaded, requested } = state
  const fresh = padBbox(viewport, padFactor)
  if (requested && regionCovers(requested, viewport) && !crossesIntoServerPins(requested, fresh)) {
    return { action: "keep" }
  }
  if (loaded && regionCovers(loaded, viewport) && !crossesIntoServerPins(loaded, fresh)) {
    return { action: "revert", region: loaded }
  }
  return { action: "request", region: fresh }
}
