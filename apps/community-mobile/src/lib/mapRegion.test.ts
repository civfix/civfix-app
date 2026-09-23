import { test } from "node:test"
import assert from "node:assert/strict"
import type { BBox } from "@civfix/shared"
import {
  decideRegionFetch,
  impliedZoomForBBox,
  padBbox,
  regionCovers,
  serverReturnsPins,
  PAD_FACTOR,
  SERVER_PIN_ZOOM,
} from "./mapRegion.ts"

function viewportOf(half: number): BBox {
  return { west: -half, east: half, south: -half, north: half }
}

const VIEWPORT = viewportOf(0.1)
const REGION = padBbox(VIEWPORT, PAD_FACTOR)

function shifted(b: BBox, d: number): BBox {
  return { ...b, west: b.west + d, east: b.east + d }
}

test("a padded region covers the viewport it was built from", () => {
  assert.equal(regionCovers(REGION, VIEWPORT), true)
})

test("the first settle requests a padded region", () => {
  const decision = decideRegionFetch({ loaded: null, requested: null }, VIEWPORT)
  assert.equal(decision.action, "request")
  assert.deepEqual(decision.action === "request" ? decision.region : null, REGION)
})

test("settles inside the in-flight region are deduped", () => {
  const decision = decideRegionFetch(
    { loaded: null, requested: REGION },
    shifted(VIEWPORT, 0.005),
  )
  assert.equal(decision.action, "keep")
})

test("panning back onto the region we hold reverts to it instead of a third fetch", () => {
  const far = padBbox(shifted(VIEWPORT, 5), PAD_FACTOR)
  const decision = decideRegionFetch({ loaded: REGION, requested: far }, VIEWPORT)
  assert.equal(decision.action, "revert")
  assert.deepEqual(decision.action === "revert" ? decision.region : null, REGION)
})

test("panning out of both regions requests a fresh one", () => {
  const viewport = shifted(VIEWPORT, 5)
  const decision = decideRegionFetch({ loaded: REGION, requested: REGION }, viewport)
  assert.equal(decision.action, "request")
  assert.deepEqual(
    decision.action === "request" ? decision.region : null,
    padBbox(viewport, PAD_FACTOR),
  )
})

test("zooming in past the loaded sample refetches a tighter region", () => {
  const zoomedIn = viewportOf(0.01)
  const decision = decideRegionFetch({ loaded: REGION, requested: REGION }, zoomedIn)
  assert.equal(decision.action, "request")
})

test("a FAILED region fetch (both refs cleared) re-requests on the next settle", () => {
  // useMapReports sets retry:false, so a region committed as loaded at request time would report "keep"
  // forever and strand the map on empty pins.
  const afterError = decideRegionFetch({ loaded: null, requested: null }, shifted(VIEWPORT, 0.005))
  assert.equal(afterError.action, "request")
})

/** Centered on downtown LA so the latitude term is the one that actually binds, as it does on a phone. */
function boxAround(halfLng: number, halfLat: number): BBox {
  return { west: -118.25 - halfLng, east: -118.25 + halfLng, south: 34.05 - halfLat, north: 34.05 + halfLat }
}

// A viewport whose PADDED region still reads as aggregates, and the tighter one that earns pins.
const AGGREGATE_VIEWPORT = boxAround(1, 0.5)
const AGGREGATE_REGION = padBbox(AGGREGATE_VIEWPORT, PAD_FACTOR)
const PIN_VIEWPORT = boxAround(0.8, 0.4)

test("the server pin threshold matches the one the shared clusterer exports as AGGREGATE_EXPAND_ZOOM", () => {
  assert.equal(SERVER_PIN_ZOOM, 10)
})

test("implied zoom is the server's own bbox clamp, so the two agree on which side of the line a region is", () => {
  assert.equal(impliedZoomForBBox({ west: -180, east: 180, south: -85, north: 85 }), 3)
  assert.equal(impliedZoomForBBox({ west: -119.0, east: -117.6, south: 33.7, north: 34.8 }), 10)
  assert.equal(impliedZoomForBBox({ west: 0, east: 0, south: 0, north: 0 }), 0)
  assert.equal(serverReturnsPins(AGGREGATE_REGION), false)
  assert.equal(serverReturnsPins(padBbox(PIN_VIEWPORT, PAD_FACTOR)), true)
})

test("crossing INTO the server's pin zoom refetches immediately instead of waiting out the hysteresis", () => {
  // The aggregate region still covers the tighter viewport, so the plain coverage rule would keep it and
  // leave the stale bubbles on screen for another whole zoom level.
  assert.equal(regionCovers(AGGREGATE_REGION, PIN_VIEWPORT), true)
  const decision = decideRegionFetch(
    { loaded: AGGREGATE_REGION, requested: AGGREGATE_REGION },
    PIN_VIEWPORT,
  )
  assert.equal(decision.action, "request")
  assert.deepEqual(
    decision.action === "request" ? decision.region : null,
    padBbox(PIN_VIEWPORT, PAD_FACTOR),
  )
})

test("a loaded aggregate region cannot be REVERTED to once the viewport has earned pins", () => {
  const far = padBbox({ west: -50, east: -40, south: 10, north: 20 }, PAD_FACTOR)
  const decision = decideRegionFetch({ loaded: AGGREGATE_REGION, requested: far }, PIN_VIEWPORT)
  assert.equal(decision.action, "request")
})

test("the forced refetch fires once: the pin-scale region it asks for then settles to keep", () => {
  const pinRegion = padBbox(PIN_VIEWPORT, PAD_FACTOR)
  assert.equal(decideRegionFetch({ loaded: pinRegion, requested: pinRegion }, PIN_VIEWPORT).action, "keep")
})

test("zooming out from pins back to aggregate scale is left to the ordinary coverage rule", () => {
  const pinRegion = padBbox(PIN_VIEWPORT, PAD_FACTOR)
  const slightlyWider = boxAround(0.82, 0.41)
  assert.equal(regionCovers(pinRegion, slightlyWider), true)
  assert.equal(decideRegionFetch({ loaded: pinRegion, requested: pinRegion }, slightlyWider).action, "keep")
})
