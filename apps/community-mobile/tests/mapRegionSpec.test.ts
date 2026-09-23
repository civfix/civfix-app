import assert from "node:assert/strict"
import { test } from "node:test"
import * as mapRegion from "../src/lib/mapRegion.ts"
import {
  COVERS_CASES,
  DECISION_CASES,
  IMPLIED_ZOOM_CASES,
  PAD_CASES,
  REGION_FETCH_CONSTANTS,
  REGION_WALK,
  bboxesClose,
  decisionsMatch,
  runRegionFetchWalk,
} from "../../../packages/ui/src/map/__tests__/regionFetchSpec.ts"

test("mobile region fetch uses the spec's constants", () => {
  assert.deepEqual(
    {
      PAD_FACTOR: mapRegion.PAD_FACTOR,
      EDGE_MARGIN: mapRegion.EDGE_MARGIN,
      MAX_COARSENESS: mapRegion.MAX_COARSENESS,
      SERVER_PIN_ZOOM: mapRegion.SERVER_PIN_ZOOM,
      VIEWPORT_REFERENCE_TILES: mapRegion.VIEWPORT_REFERENCE_TILES,
    },
    REGION_FETCH_CONSTANTS,
  )
})

for (const { name, bbox, zoom, pins } of IMPLIED_ZOOM_CASES) {
  test(`mobile implied zoom: ${name}`, () => {
    assert.equal(mapRegion.impliedZoomForBBox(bbox), zoom)
    assert.equal(mapRegion.serverReturnsPins(bbox), pins)
  })
}

for (const { name, bbox, factor, padded } of PAD_CASES) {
  test(`mobile padding: ${name}`, () => {
    const actual = mapRegion.padBbox(bbox, factor)
    assert.ok(bboxesClose(actual, padded), JSON.stringify(actual))
  })
}

for (const { name, loaded, viewport, covers } of COVERS_CASES) {
  test(`mobile coverage: ${name}`, () => {
    assert.equal(mapRegion.regionCovers(loaded, viewport), covers)
  })
}

for (const { name, state, viewport, padFactor, decision } of DECISION_CASES) {
  test(`mobile decision: ${name}`, () => {
    const actual = mapRegion.decideRegionFetch(state, viewport, padFactor)
    assert.ok(decisionsMatch(actual, decision), JSON.stringify(actual))
  })
}

test("mobile region fetch makes the spec's decisions over a seeded random walk of pans and zooms", () => {
  assert.deepEqual(runRegionFetchWalk(mapRegion, REGION_WALK.seed, REGION_WALK.steps), REGION_WALK.expected)
})
