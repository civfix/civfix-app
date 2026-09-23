import { describe, expect, it } from "vitest"

import * as regionFetch from "./region-fetch"
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
} from "../../../../../packages/ui/src/map/__tests__/regionFetchSpec"

describe("web region fetch meets the shared region-fetch spec", () => {
  it("uses the spec's constants", () => {
    expect({
      PAD_FACTOR: regionFetch.PAD_FACTOR,
      EDGE_MARGIN: regionFetch.EDGE_MARGIN,
      MAX_COARSENESS: regionFetch.MAX_COARSENESS,
      SERVER_PIN_ZOOM: regionFetch.SERVER_PIN_ZOOM,
      VIEWPORT_REFERENCE_TILES: regionFetch.VIEWPORT_REFERENCE_TILES,
    }).toEqual(REGION_FETCH_CONSTANTS)
  })

  it.each(IMPLIED_ZOOM_CASES)("implied zoom: $name", ({ bbox, zoom, pins }) => {
    expect(regionFetch.impliedZoomForBBox(bbox)).toBe(zoom)
    expect(regionFetch.serverReturnsPins(bbox)).toBe(pins)
  })

  it.each(PAD_CASES)("padding: $name", ({ bbox, factor, padded }) => {
    const actual = regionFetch.padBbox(bbox, factor)
    expect(bboxesClose(actual, padded), JSON.stringify(actual)).toBe(true)
  })

  it.each(COVERS_CASES)("coverage: $name", ({ loaded, viewport, covers }) => {
    expect(regionFetch.regionCovers(loaded, viewport)).toBe(covers)
  })

  it.each(DECISION_CASES)("decision: $name", ({ state, viewport, padFactor, decision }) => {
    const actual = regionFetch.decideRegionFetch(state, viewport, padFactor)
    expect(decisionsMatch(actual, decision), JSON.stringify(actual)).toBe(true)
  })

  it("makes the spec's decisions over a seeded random walk of pans and zooms", () => {
    expect(runRegionFetchWalk(regionFetch, REGION_WALK.seed, REGION_WALK.steps)).toEqual(REGION_WALK.expected)
  })
})
