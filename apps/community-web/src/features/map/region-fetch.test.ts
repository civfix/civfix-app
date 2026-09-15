import type { BBox } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  decideRegionFetch,
  impliedZoomForBBox,
  padBbox,
  regionCovers,
  serverReturnsPins,
  PAD_FACTOR,
  SERVER_PIN_ZOOM,
  type RegionFetchState,
} from "./region-fetch"

/**
 * Region-fetch decisions for the web home map (see region-fetch.ts).
 *
 * The two regressions these lock down (a settle-driven map that consulted only ONE of the two regions):
 *   1. Duplicate-fetch churn: while the query for a NEW region is in flight, every further settle inside
 *      it re-padded and re-requested a slightly different bbox because the decision was made against the
 *      still-LOADED old region.
 *   2. A stranded, pin-less map: panning out and then quickly back (before the new region resolved) was
 *      suppressed by the loaded region, so the in-flight FAR region's points landed under a viewport that
 *      no longer showed them and nothing re-requested the visible area.
 */

function box(west: number, south: number, east: number, north: number): BBox {
  return { west, south, east, north }
}

/** A viewport and the padded region the map fetches for it (PAD_FACTOR 0.6 -> 1.6x per axis). */
const V1 = box(0, 0, 10, 10)
const R1 = padBbox(V1, 0.6) // -3 .. 13
const V2 = box(40, 0, 50, 10)
const R2 = padBbox(V2, 0.6) // 37 .. 53
const FAR = box(100, 100, 110, 110)

function state(loaded: BBox | null, requested: BBox | null): RegionFetchState {
  return { loaded, requested }
}

/**
 * A mutable stand-in for HomeMap's two refs + `bbox` state: `settle` mirrors onRegionChange and
 * `resolve` mirrors the effect that commits the requested region as loaded once its query lands.
 */
function createMapDriver() {
  const s: RegionFetchState = { loaded: null, requested: null }
  const requests: BBox[] = []
  return {
    settle(viewport: BBox) {
      const decision = decideRegionFetch(s, viewport)
      if (decision.action === "keep") return decision.action
      s.requested = decision.region
      if (decision.action === "request") requests.push(decision.region)
      return decision.action
    },
    resolve() {
      s.loaded = s.requested
    },
    requests,
    state: s,
  }
}

describe("padBbox", () => {
  it("grows the viewport symmetrically by the factor per axis", () => {
    expect(padBbox(V1, 0.6)).toEqual(box(-3, -3, 13, 13))
  })

  it("always yields a region that covers the viewport it was padded from", () => {
    // The self-coverage invariant: without it a settle would request forever (request -> still not
    // covered -> request ...). Checked across shapes/scales the map really sees.
    for (const viewport of [V1, V2, FAR, box(-122.5, 37.6, -122.3, 37.8), box(-0.01, 51.5, 0.01, 51.52)]) {
      expect(regionCovers(padBbox(viewport, 0.6), viewport)).toBe(true)
    }
  })
})

describe("regionCovers", () => {
  it("rejects a viewport that has drifted within the edge margin", () => {
    expect(regionCovers(R1, box(-2, 0, 8, 10))).toBe(false)
  })

  it("rejects a region that has become too coarse for a zoomed-in viewport", () => {
    // Inside R1, but R1 is 16 wide against a 2-wide viewport (> MAX_COARSENESS) - the capped sample
    // must re-tighten around the smaller view.
    expect(regionCovers(R1, box(4, 4, 6, 6))).toBe(false)
  })
})

describe("decideRegionFetch", () => {
  it("requests a padded region when nothing is loaded or requested yet", () => {
    expect(decideRegionFetch(state(null, null), V1)).toEqual({ action: "request", region: R1 })
  })

  it("keeps the current request while the viewport stays inside the loaded region", () => {
    expect(decideRegionFetch(state(R1, R1), box(1, 1, 9, 9))).toEqual({ action: "keep" })
  })

  it("keeps the in-flight request when the viewport is inside it but outside the loaded region", () => {
    // Regression 1: the settles of a pan into a new area must NOT restart the request that is already
    // fetching that area just because the previously LOADED region does not cover the viewport.
    expect(decideRegionFetch(state(R1, R2), box(41, 1, 49, 9))).toEqual({ action: "keep" })
  })

  it("reverts to the loaded region when the viewport pans back off the in-flight one", () => {
    // Regression 2: re-point the query at the region we already hold (a cache hit) so the pins on
    // screen belong to the visible area instead of the region still loading 40 degrees away.
    const decision = decideRegionFetch(state(R1, R2), V1)
    expect(decision).toEqual({ action: "revert", region: R1 })
    // Identity matters: the same bbox object re-uses the cached query entry rather than keying a new one.
    expect(decision.action === "revert" && decision.region).toBe(R1)
  })

  it("requests a fresh region when neither the loaded nor the requested one covers the viewport", () => {
    expect(decideRegionFetch(state(R1, R2), FAR)).toEqual({ action: "request", region: padBbox(FAR, 0.6) })
  })

  it("re-requests after a failed fetch cleared both regions, even without moving", () => {
    // The commit effect nulls both refs on error; the next settle must fetch again rather than treat
    // the failed region as covered.
    expect(decideRegionFetch(state(null, null), box(1, 1, 9, 9))).toEqual({
      action: "request",
      region: padBbox(box(1, 1, 9, 9), 0.6),
    })
  })

  it("re-requests on zoom-in even though the viewport sits inside both regions", () => {
    const viewport = box(4, 4, 6, 6)
    expect(decideRegionFetch(state(R1, R1), viewport)).toEqual({
      action: "request",
      region: padBbox(viewport, 0.6),
    })
  })
})

describe("settle sequences", () => {
  it("issues exactly one request for a pan into a new area, however many settles it takes", () => {
    const map = createMapDriver()
    map.settle(V1)
    map.resolve()
    expect(map.requests).toHaveLength(1)

    // A pan east: the first settle that leaves R1 requests R2; every later settle inside R2 is deduped
    // while that query is still in flight (no resolve() between them).
    expect(map.settle(box(38, 0, 48, 10))).toBe("request")
    expect(map.settle(box(39, 0, 49, 10))).toBe("keep")
    expect(map.settle(box(38.5, 0.5, 48.5, 10.5))).toBe("keep")
    expect(map.requests).toHaveLength(2)
  })

  it("leaves the map showing the region under the viewport after a pan out and straight back", () => {
    const map = createMapDriver()
    map.settle(V1)
    map.resolve()
    const loaded = map.state.loaded

    map.settle(V2) // requests R2; still in flight
    expect(map.settle(V1)).toBe("revert")
    expect(map.state.requested).toBe(loaded)

    // Once that (cached) region commits, the map is back in a steady state - no extra fetch, and the
    // next settle in the same place is a no-op instead of the map sitting pin-less until the user moves.
    map.resolve()
    expect(map.state.loaded).toBe(loaded)
    expect(map.settle(box(1, 1, 9, 9))).toBe("keep")
    expect(map.requests).toHaveLength(2)
  })
})

describe("the server pin threshold", () => {
  /** Centered on downtown LA so the latitude term binds, as it does on a real viewport. */
  function boxAround(halfLng: number, halfLat: number): BBox {
    return { west: -118.25 - halfLng, east: -118.25 + halfLng, south: 34.05 - halfLat, north: 34.05 + halfLat }
  }

  const AGGREGATE_VIEWPORT = boxAround(1, 0.5)
  const AGGREGATE_REGION = padBbox(AGGREGATE_VIEWPORT, PAD_FACTOR)
  const PIN_VIEWPORT = boxAround(0.8, 0.4)
  const PIN_REGION = padBbox(PIN_VIEWPORT, PAD_FACTOR)

  it("is the zoom the shared clusterer exports as AGGREGATE_EXPAND_ZOOM", () => {
    expect(SERVER_PIN_ZOOM).toBe(10)
  })

  it("derives a region's zoom exactly as the server's bbox clamp does", () => {
    expect(impliedZoomForBBox(box(-180, -85, 180, 85))).toBe(3)
    expect(impliedZoomForBBox(box(-119.0, 33.7, -117.6, 34.8))).toBe(10)
    expect(impliedZoomForBBox(box(0, 0, 0, 0))).toBe(0)
    expect(serverReturnsPins(AGGREGATE_REGION)).toBe(false)
    expect(serverReturnsPins(PIN_REGION)).toBe(true)
  })

  it("refetches the moment the viewport crosses into pins, without waiting out the hysteresis", () => {
    // Coverage alone would hold the aggregate region for another ~1.13 zoom levels, so the bubbles stayed
    // on screen long after the map should have broken into individual pins.
    expect(regionCovers(AGGREGATE_REGION, PIN_VIEWPORT)).toBe(true)
    expect(decideRegionFetch(state(AGGREGATE_REGION, AGGREGATE_REGION), PIN_VIEWPORT)).toEqual({
      action: "request",
      region: PIN_REGION,
    })
  })

  it("will not revert onto a loaded aggregate region once the viewport has earned pins", () => {
    expect(decideRegionFetch(state(AGGREGATE_REGION, padBbox(FAR, PAD_FACTOR)), PIN_VIEWPORT).action).toBe(
      "request",
    )
  })

  it("fires that refetch once, then settles", () => {
    expect(decideRegionFetch(state(PIN_REGION, PIN_REGION), PIN_VIEWPORT)).toEqual({ action: "keep" })
  })

  it("leaves the pins-to-aggregates direction to the ordinary coverage rule", () => {
    const slightlyWider = boxAround(0.82, 0.41)
    expect(regionCovers(PIN_REGION, slightlyWider)).toBe(true)
    expect(decideRegionFetch(state(PIN_REGION, PIN_REGION), slightlyWider)).toEqual({ action: "keep" })
  })
})
