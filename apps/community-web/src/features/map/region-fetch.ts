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
 */
export const PAD_FACTOR = 0.6
export const EDGE_MARGIN = 0.12
export const MAX_COARSENESS = 3.5

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
 * onto data we already have, so we revert rather than fire a third fetch.
 */
export function decideRegionFetch(
  state: RegionFetchState,
  viewport: BBox,
  padFactor: number = PAD_FACTOR,
): RegionFetchDecision {
  const { loaded, requested } = state
  if (requested && regionCovers(requested, viewport)) return { action: "keep" }
  if (loaded && regionCovers(loaded, viewport)) return { action: "revert", region: loaded }
  return { action: "request", region: padBbox(viewport, padFactor) }
}
