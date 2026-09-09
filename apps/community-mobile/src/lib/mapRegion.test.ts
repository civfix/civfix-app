import { test } from "node:test"
import assert from "node:assert/strict"
import type { BBox } from "@civfix/shared"
import { decideRegionFetch, padBbox, regionCovers, PAD_FACTOR } from "./mapRegion.ts"

/** A square viewport centered on (0,0) with the given half-size in degrees. */
function viewportOf(half: number): BBox {
  return { west: -half, east: half, south: -half, north: half }
}

const VIEWPORT = viewportOf(0.1)
const REGION = padBbox(VIEWPORT, PAD_FACTOR)

/** Shift a bbox east by `d` degrees (a pan). */
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
  // A long pan settles repeatedly while its query is still running: no second request.
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
  // The screen clears `loaded` + `requested` when the reports query errors, because the shared
  // useMapReports sets retry:false. Committing the region as loaded at REQUEST time instead (the old
  // behavior) left this settle reporting "keep" forever - the map stranded on empty pins while the user
  // panned inside a region whose fetch had failed.
  const afterError = decideRegionFetch({ loaded: null, requested: null }, shifted(VIEWPORT, 0.005))
  assert.equal(afterError.action, "request")
})
