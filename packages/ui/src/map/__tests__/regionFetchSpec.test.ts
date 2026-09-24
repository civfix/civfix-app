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
  type RegionFetchDecision,
  type RegionFetchState,
} from "../regionFetch"

const BBOX_TOLERANCE = 1e-9

function bboxesClose(a: BBox, b: BBox): boolean {
  return (
    Math.abs(a.west - b.west) < BBOX_TOLERANCE &&
    Math.abs(a.south - b.south) < BBOX_TOLERANCE &&
    Math.abs(a.east - b.east) < BBOX_TOLERANCE &&
    Math.abs(a.north - b.north) < BBOX_TOLERANCE
  )
}

function decisionsMatch(actual: RegionFetchDecision, expected: RegionFetchDecision): boolean {
  if (actual.action !== expected.action) return false
  if (actual.action === "keep" || expected.action === "keep") return true
  return bboxesClose(actual.region, expected.region)
}

const box = (west: number, south: number, east: number, north: number): BBox => ({ west, south, east, north })

/** Downtown LA, where the latitude term binds as it does on a phone. */
const aroundLA = (halfLng: number, halfLat: number): BBox =>
  box(-118.25 - halfLng, 34.05 - halfLat, -118.25 + halfLng, 34.05 + halfLat)

const IMPLIED_ZOOM_CASES: { name: string; bbox: BBox; zoom: number; pins: boolean }[] = [
  { name: "the whole world is zoom 3", bbox: box(-180, -85, 180, 85), zoom: 3, pins: false },
  { name: "a 1.4 degree LA viewport is zoom 10", bbox: box(-119.0, 33.7, -117.6, 34.8), zoom: 10, pins: true },
  { name: "a zero-size box is zoom 0", bbox: box(0, 0, 0, 0), zoom: 0, pins: false },
  { name: "a 2.8125 degree span sits exactly on the pin zoom", bbox: box(0, 0, 2.8125, 1), zoom: 10, pins: true },
  { name: "a span just wider than 2.8125 degrees is aggregates", bbox: box(0, 0, 2.82, 1), zoom: 9, pins: false },
  { name: "latitude binds at twice its extent", bbox: box(0, 0, 1, 2), zoom: 9, pins: false },
  { name: "a 1.40625 degree tall box reaches the pin zoom through latitude", bbox: box(0, 0, 1, 1.40625), zoom: 10, pins: true },
  { name: "a 5.625 degree span is zoom 9", bbox: box(0, 0, 5.625, 1), zoom: 9, pins: false },
  { name: "a microscopic box clamps to zoom 22", bbox: box(0, 0, 1e-6, 1e-7), zoom: 22, pins: true },
  { name: "a span wider than the reference clamps to zoom 0", bbox: box(0, 0, 5000, 1), zoom: 0, pins: false },
  { name: "an antimeridian-crossing box (west > east) is not wrapped: only its latitude counts", bbox: box(179, -1, -179, 1), zoom: 9, pins: false },
  { name: "a fully inverted box is zoom 0", bbox: box(10, 5, 0, 0), zoom: 0, pins: false },
  { name: "a NaN edge is zoom 0", bbox: box(Number.NaN, 0, 1, 1), zoom: 0, pins: false },
]

const PAD_CASES: { name: string; bbox: BBox; factor: number; padded: BBox }[] = [
  { name: "the default factor grows each axis by 60%", bbox: box(-118.5, 33.75, -117.5, 34.25), factor: 0.6, padded: box(-118.8, 33.6, -117.2, 34.4) },
  { name: "a zero factor leaves the box unchanged", bbox: box(-118.5, 33.75, -117.5, 34.25), factor: 0, padded: box(-118.5, 33.75, -117.5, 34.25) },
  { name: "padding near a pole is not clamped to 90", bbox: box(0, 80, 10, 89), factor: 0.6, padded: box(-3, 77.3, 13, 91.7) },
  { name: "an antimeridian-crossing box is padded inward, not wrapped", bbox: box(179, -1, -179, 1), factor: 0.6, padded: box(286.4, -1.6, -286.4, 1.6) },
]

// Width 1 x height 0.5 around LA; padded it is width 1.6 x height 0.8, a pin-scale region.
const VIEWPORT = box(-118.5, 33.8, -117.5, 34.3)
const REGION = box(-118.8, 33.65, -117.2, 34.45)
const panEast = (b: BBox, d: number): BBox => box(b.west + d, b.south, b.east + d, b.north)
const panNorth = (b: BBox, d: number): BBox => box(b.west, b.south + d, b.east, b.north + d)

const COVERS_CASES: { name: string; loaded: BBox; viewport: BBox; covers: boolean }[] = [
  { name: "a padded region covers the viewport it was built from", loaded: REGION, viewport: VIEWPORT, covers: true },
  { name: "a pan that stays inside the 12% edge margin is covered", loaded: REGION, viewport: panEast(VIEWPORT, 0.1), covers: true },
  { name: "a pan into the east edge margin is not covered", loaded: REGION, viewport: panEast(VIEWPORT, 0.11), covers: false },
  { name: "a pan into the west edge margin is not covered", loaded: REGION, viewport: panEast(VIEWPORT, -0.11), covers: false },
  { name: "a pan that stays inside the north margin is covered", loaded: REGION, viewport: panNorth(VIEWPORT, 0.05), covers: true },
  { name: "a pan into the north edge margin is not covered", loaded: REGION, viewport: panNorth(VIEWPORT, 0.06), covers: false },
  { name: "a pan into the south edge margin is not covered", loaded: REGION, viewport: panNorth(VIEWPORT, -0.06), covers: false },
  { name: "zooming in to a viewport 1/3.48 of the region is still fine enough", loaded: REGION, viewport: box(-118.23, 33.95, -117.77, 34.15), covers: true },
  { name: "zooming in past 3.5x coarseness is not covered", loaded: REGION, viewport: box(-118.225, 33.95, -117.775, 34.15), covers: false },
  { name: "zooming out to the region itself is not covered", loaded: REGION, viewport: REGION, covers: false },
]

// Width 2 x height 1: its padded region is zoom 9 (aggregates). Width 1.6 x height 0.8: zoom 10 (pins).
const AGGREGATE_VIEWPORT = aroundLA(1, 0.5)
const AGGREGATE_REGION = box(-119.85, 33.25, -116.65, 34.85)
const PIN_VIEWPORT = aroundLA(0.8, 0.4)
const PIN_REGION = box(-119.53, 33.41, -116.97, 34.69)
const FAR_REGION = box(-113.8, 33.65, -112.2, 34.45)

const DECISION_CASES: {
  name: string
  state: RegionFetchState
  viewport: BBox
  padFactor?: number
  decision: RegionFetchDecision
}[] = [
  {
    name: "the first settle requests the padded viewport",
    state: { loaded: null, requested: null },
    viewport: VIEWPORT,
    decision: { action: "request", region: REGION },
  },
  {
    name: "a settle inside the in-flight request is deduped",
    state: { loaded: null, requested: REGION },
    viewport: panEast(VIEWPORT, 0.05),
    decision: { action: "keep" },
  },
  {
    name: "the requested region wins over a loaded one that also covers",
    state: { loaded: panEast(REGION, 0.05), requested: REGION },
    viewport: VIEWPORT,
    decision: { action: "keep" },
  },
  {
    name: "panning back onto the loaded region while another is in flight reverts to it",
    state: { loaded: REGION, requested: FAR_REGION },
    viewport: VIEWPORT,
    decision: { action: "revert", region: REGION },
  },
  {
    name: "panning out of both regions requests a fresh padded one",
    state: { loaded: REGION, requested: REGION },
    viewport: panEast(VIEWPORT, 5),
    decision: { action: "request", region: FAR_REGION },
  },
  {
    name: "after a failed fetch clears both regions the next settle re-requests",
    state: { loaded: null, requested: null },
    viewport: panEast(VIEWPORT, 0.05),
    decision: { action: "request", region: box(-118.75, 33.65, -117.15, 34.45) },
  },
  {
    name: "a pan inside the edge margin keeps the region",
    state: { loaded: REGION, requested: REGION },
    viewport: panEast(VIEWPORT, 0.1),
    decision: { action: "keep" },
  },
  {
    name: "a pan into the edge margin requests a region around the new viewport",
    state: { loaded: REGION, requested: REGION },
    viewport: panEast(VIEWPORT, 0.11),
    decision: { action: "request", region: box(-118.69, 33.65, -117.09, 34.45) },
  },
  {
    name: "zooming in within 3.5x coarseness keeps the region",
    state: { loaded: REGION, requested: REGION },
    viewport: box(-118.23, 33.95, -117.77, 34.15),
    decision: { action: "keep" },
  },
  {
    name: "zooming in past 3.5x coarseness requests a tighter region",
    state: { loaded: REGION, requested: REGION },
    viewport: box(-118.225, 33.95, -117.775, 34.15),
    decision: { action: "request", region: box(-118.36, 33.89, -117.64, 34.21) },
  },
  {
    name: "crossing into the server pin zoom refetches although the aggregate region still covers",
    state: { loaded: AGGREGATE_REGION, requested: AGGREGATE_REGION },
    viewport: PIN_VIEWPORT,
    decision: { action: "request", region: PIN_REGION },
  },
  {
    name: "a loaded aggregate region cannot be reverted to once the viewport has earned pins",
    state: { loaded: AGGREGATE_REGION, requested: FAR_REGION },
    viewport: PIN_VIEWPORT,
    decision: { action: "request", region: PIN_REGION },
  },
  {
    name: "an aggregate request that crosses into pins yields to a loaded pin region that covers",
    state: { loaded: PIN_REGION, requested: AGGREGATE_REGION },
    viewport: PIN_VIEWPORT,
    decision: { action: "revert", region: PIN_REGION },
  },
  {
    name: "the forced pin refetch fires once: its own region then keeps",
    state: { loaded: PIN_REGION, requested: PIN_REGION },
    viewport: PIN_VIEWPORT,
    decision: { action: "keep" },
  },
  {
    name: "zooming out slightly from pins is left to the coverage rule",
    state: { loaded: PIN_REGION, requested: PIN_REGION },
    viewport: aroundLA(0.82, 0.41),
    decision: { action: "keep" },
  },
  {
    name: "zooming out from pins to aggregate scale requests the aggregate region",
    state: { loaded: PIN_REGION, requested: PIN_REGION },
    viewport: AGGREGATE_VIEWPORT,
    decision: { action: "request", region: AGGREGATE_REGION },
  },
  {
    name: "an explicit pad factor overrides the default",
    state: { loaded: null, requested: null },
    viewport: VIEWPORT,
    padFactor: 0,
    decision: { action: "request", region: VIEWPORT },
  },
]

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

type RegionWalkResult = { keep: number; revert: number; request: number; digest: string }

/**
 * Drives `decideRegionFetch` through a seeded random sequence of pans and zooms, applying each decision
 * the way the hosts do: a request or revert re-points `requested`, and on later settles an in-flight
 * request either succeeds (promoted to `loaded`), fails (both cleared) or is still pending.
 */
function runRegionFetchWalk(seed: number, steps: number): RegionWalkResult {
  const random = mulberry32(seed)
  const result: RegionWalkResult = { keep: 0, revert: 0, request: 0, digest: "" }
  const trace: string[] = []
  let state: RegionFetchState = { loaded: null, requested: null }
  let inFlight = false
  let lng = -118.25
  let lat = 34.05
  let halfLng = 0.5
  for (let step = 0; step < steps; step++) {
    if (inFlight) {
      const outcome = random()
      if (outcome < 0.6) {
        state = { loaded: state.requested, requested: state.requested }
        inFlight = false
      } else if (outcome < 0.7) {
        state = { loaded: null, requested: null }
        inFlight = false
      }
    }
    if (random() < 0.5) {
      lng += (random() - 0.5) * 1.2 * halfLng
      lat += (random() - 0.5) * 0.6 * halfLng
    } else {
      halfLng = Math.min(60, Math.max(0.001, halfLng * 2 ** ((random() - 0.5) * 2)))
    }
    const viewport = box(lng - halfLng, lat - halfLng / 2, lng + halfLng, lat + halfLng / 2)
    const decision = decideRegionFetch(state, viewport)
    result[decision.action] += 1
    if (decision.action === "keep") {
      trace.push("k")
    } else {
      const r = decision.region
      trace.push(`${decision.action[0]}${[r.west, r.south, r.east, r.north].map((v) => v.toFixed(6)).join(",")}`)
      inFlight = decision.action === "request"
      state = { loaded: state.loaded, requested: decision.region }
    }
  }
  result.digest = fnv1a(trace.join(";"))
  return result
}

const REGION_WALK = {
  seed: 20260923,
  steps: 500,
  expected: { keep: 212, revert: 4, request: 284, digest: "b12098cb" } satisfies RegionWalkResult,
}

describe("region-fetch spec", () => {
  it("pads by 60% and switches the server to pins at zoom 10", () => {
    expect({ PAD_FACTOR, SERVER_PIN_ZOOM }).toEqual({ PAD_FACTOR: 0.6, SERVER_PIN_ZOOM: 10 })
  })

  it.each(IMPLIED_ZOOM_CASES)("implied zoom: $name", ({ bbox, zoom, pins }) => {
    expect(impliedZoomForBBox(bbox)).toBe(zoom)
    expect(serverReturnsPins(bbox)).toBe(pins)
  })

  it.each(PAD_CASES)("padding: $name", ({ bbox, factor, padded }) => {
    const actual = padBbox(bbox, factor)
    expect(bboxesClose(actual, padded), JSON.stringify(actual)).toBe(true)
  })

  it.each(COVERS_CASES)("coverage: $name", ({ loaded, viewport, covers }) => {
    expect(regionCovers(loaded, viewport)).toBe(covers)
  })

  it.each(DECISION_CASES)("decision: $name", ({ state, viewport, padFactor, decision }) => {
    const actual = decideRegionFetch(state, viewport, padFactor)
    expect(decisionsMatch(actual, decision), JSON.stringify(actual)).toBe(true)
  })

  it("makes the spec's decisions over a seeded random walk of pans and zooms", () => {
    expect(runRegionFetchWalk(REGION_WALK.seed, REGION_WALK.steps)).toEqual(REGION_WALK.expected)
  })
})
