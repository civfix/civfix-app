import type { BBox } from "@civfix/shared"

/**
 * The web home map's region-fetch decision (pure, so it is unit-testable without a map or a network).
 *
 * Clustering is CLIENT-SIDE (the shared Map), so we fetch RAW points for a PADDED region (bigger than
 * the viewport) and the Map reclusters locally as the user zooms/pans - no per-zoom network call. We
 * refetch only when the viewport leaves that region or zooms in far enough that the region's capped
 * sample is too coarse:
 *   - PAD_FACTOR: grow the viewport this much per axis when fetching (0.6 -> region is 1.6x the viewport).
 *   - EDGE_MARGIN: refetch once the viewport comes within this fraction of a loaded-region edge (pan / zoom-out).
 *   - MAX_COARSENESS: refetch once the loaded region is this many times wider than the viewport (zoom-in),
 *     so the <=2000-candidate sample re-tightens around the smaller view and stays dense.
 *
 * That hysteresis has ONE override. The server answers with grid AGGREGATES below SERVER_PIN_ZOOM and
 * with individual pins at/above it, and it derives that zoom from the fetch BBOX alone (impliedZoomForBBox
 * here is the same derivation, same reference viewport). MAX_COARSENESS 3.5 against a 1.6x pad means a
 * held region survives until the viewport is ~1.13 zoom levels tighter, so after the user zooms past the
 * pin threshold the stale AGGREGATES stayed on screen for a whole zoom level - the map looked grouped
 * long after it should have broken apart. So when the region we would fetch NOW clears the threshold and
 * the one we hold does not, the crossing itself forces the refetch.
 */
export const PAD_FACTOR = 0.6
export const EDGE_MARGIN = 0.12
export const MAX_COARSENESS = 3.5
export const SERVER_PIN_ZOOM = 10
export const VIEWPORT_REFERENCE_TILES = 8

/** The largest zoom a viewport of this extent could be displaying - the server's own bbox->zoom clamp. */
export function impliedZoomForBBox(b: BBox): number {
  const span = Math.max(b.east - b.west, (b.north - b.south) * 2)
  if (!Number.isFinite(span) || span <= 0) return 0
  const zoom = Math.log2((360 * VIEWPORT_REFERENCE_TILES) / span)
  if (!Number.isFinite(zoom)) return 0
  return Math.max(0, Math.min(22, Math.floor(zoom)))
}

/** Whether a fetch for this region comes back as individual pins rather than server aggregates. */
export function serverReturnsPins(region: BBox): boolean {
  return impliedZoomForBBox(region) >= SERVER_PIN_ZOOM
}

function crossesIntoServerPins(held: BBox, fresh: BBox): boolean {
  return serverReturnsPins(fresh) && !serverReturnsPins(held)
}

/** Grow a bbox outward by `factor` per axis (so a small pan/zoom-out stays inside the loaded points). */
export function padBbox(b: BBox, factor: number): BBox {
  const dw = ((b.east - b.west) * factor) / 2
  const dh = ((b.north - b.south) * factor) / 2
  return { west: b.west - dw, south: b.south - dh, east: b.east + dw, north: b.north + dh }
}

/** Whether the loaded region still covers the viewport well enough to skip a refetch (recluster locally). */
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
 * The two regions the map tracks on a move-settle:
 *   - `loaded`:    the region whose points we actually HOLD (its query resolved).
 *   - `requested`: the region the CURRENT query is for - in flight, or the loaded one once it resolved.
 * Both are needed: `requested` alone cannot survive a failed fetch, and `loaded` alone cannot dedupe
 * the settles that arrive while its successor is still in flight.
 */
export type RegionFetchState = {
  loaded: BBox | null
  requested: BBox | null
}

/**
 * What a move-settle should do:
 *   - "keep":    the in-flight/current request already covers the viewport - do nothing (dedupe).
 *   - "revert":  the viewport moved BACK inside the region we already hold while a different region is
 *                in flight. Re-point the query at the loaded region so the data that lands matches what
 *                the user is looking at (it is cached, so this repaints instantly) instead of leaving the
 *                map to swap in the far-away in-flight region's pins and sit empty.
 *   - "request": nothing we hold or asked for covers the viewport - fetch a freshly padded region.
 */
export type RegionFetchDecision =
  | { action: "keep" }
  | { action: "revert"; region: BBox }
  | { action: "request"; region: BBox }

/**
 * Decide what a move-settle over `viewport` should do given the regions we hold / have requested.
 *
 * Order matters. The REQUESTED region is checked first because it is the region whose points will
 * actually land in the map: while it covers the viewport there is nothing to do, and that is what
 * suppresses the duplicate fetch on every settle of a long pan (checking `loaded` first would report
 * "not covered" for the whole pan and restart the request per settle). Only when the request no longer
 * matches the viewport does the loaded region get a say - and if it covers, the user has panned back
 * onto data we already have, so we revert rather than fire a third fetch. Either way a region that only
 * holds server AGGREGATES loses its say the moment the viewport has tightened enough to earn pins.
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
