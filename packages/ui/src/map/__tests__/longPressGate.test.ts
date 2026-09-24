import { describe, expect, it } from "vitest"
import { MARKER_HIT, longPressHitsMarker, type LongPressBounds } from "../longPressGate"

// Round numbers so degPerPx is exactly 1e-5 on both axes and "N px away" is trivial to express.
const SIZE = { width: 400, height: 800 }
const BOUNDS: LongPressBounds = { west: -122.422, east: -122.418, south: 37.771, north: 37.779 }
const DEG_PER_PX = 1e-5

const MARKER = { lat: 37.775, lng: -122.42 }
/** `px` north of the marker (positive = above it on screen). */
const north = (px: number) => ({ lat: MARKER.lat + px * DEG_PER_PX, lng: MARKER.lng })
const east = (px: number) => ({ lat: MARKER.lat, lng: MARKER.lng + px * DEG_PER_PX })

const hits = (press: { lat: number; lng: number }, anchor: "bottom" | "center" = "bottom") =>
  longPressHitsMarker(press, [{ ...MARKER, anchor }], BOUNDS, SIZE)

describe("longPressGate: the hit box", () => {
  it("is sized off the widest rendered pin (50px active teardrop in a 64x76 viewBox)", () => {
    expect(MARKER_HIT.halfWidth).toBeGreaterThanOrEqual(25)
    expect(MARKER_HIT.height).toBeGreaterThanOrEqual(50)
    expect(MARKER_HIT.tipSlop).toBeGreaterThan(0)
    expect(MARKER_HIT.tipSlop).toBeLessThan(MARKER_HIT.height)
  })
})

describe("longPressGate: a bottom-anchored teardrop (tip on the coordinate)", () => {
  it("HITS a press exactly on the marker", () => {
    expect(hits(MARKER)).toBe(true)
  })

  it("HITS 30px north - the teardrop body rises from its tip", () => {
    expect(hits(north(30))).toBe(true)
  })

  it("MISSES 60px south - there is no pin below the tip", () => {
    expect(hits(north(-60))).toBe(false)
  })

  it("MISSES 40px laterally - a pin is only ~50px wide", () => {
    expect(hits(east(40))).toBe(false)
    expect(hits(east(-40))).toBe(false)
  })

  it("HITS a diagonal press that is inside BOTH axes", () => {
    expect(longPressHitsMarker(
      { lat: MARKER.lat + 20 * DEG_PER_PX, lng: MARKER.lng + 20 * DEG_PER_PX },
      [{ ...MARKER, anchor: "bottom" }],
      BOUNDS,
      SIZE,
    )).toBe(true)
  })

  it("defaults to the bottom anchor when none is given (every teardrop plants its tip)", () => {
    expect(longPressHitsMarker(north(30), [MARKER], BOUNDS, SIZE)).toBe(true)
    expect(longPressHitsMarker(north(-60), [MARKER], BOUNDS, SIZE)).toBe(false)
  })
})

describe("longPressGate: a centre-anchored marker (a cluster bubble)", () => {
  it("is SYMMETRIC about the coordinate - unlike the teardrop", () => {
    for (const px of [10, 20, 27, 30, 60]) {
      expect(hits(north(px), "center")).toBe(hits(north(-px), "center"))
    }
  })

  it("HITS inside half the box height and MISSES outside it", () => {
    expect(hits(north(20), "center")).toBe(true)
    expect(hits(north(-20), "center")).toBe(true)
    expect(hits(north(60), "center")).toBe(false)
    expect(hits(north(-60), "center")).toBe(false)
  })

  it("swallows a press 27px SOUTH that the same-coordinate teardrop accepts", () => {
    expect(hits(north(-27), "center")).toBe(true)
    expect(hits(north(-27), "bottom")).toBe(false)
  })
})

describe("longPressGate: multiple markers", () => {
  it("swallows the press when ANY marker is hit", () => {
    const far = { lat: 37.778, lng: -122.419 }
    expect(longPressHitsMarker(MARKER, [far, MARKER], BOUNDS, SIZE)).toBe(true)
  })

  it("accepts the press when none is hit", () => {
    const far = { lat: 37.778, lng: -122.419 }
    expect(longPressHitsMarker(north(-60), [far], BOUNDS, SIZE)).toBe(false)
  })

  it("skips a non-finite marker rather than throwing", () => {
    expect(longPressHitsMarker(MARKER, [{ lat: Number.NaN, lng: 0 }, MARKER], BOUNDS, SIZE)).toBe(true)
  })
})

describe("longPressGate: FAILS OPEN (returns false -> the long press is accepted)", () => {
  it("on a null / undefined bbox", () => {
    expect(longPressHitsMarker(MARKER, [MARKER], null, SIZE)).toBe(false)
    expect(longPressHitsMarker(MARKER, [MARKER], undefined, SIZE)).toBe(false)
  })

  it("on a null / undefined viewport size", () => {
    expect(longPressHitsMarker(MARKER, [MARKER], BOUNDS, null)).toBe(false)
    expect(longPressHitsMarker(MARKER, [MARKER], BOUNDS, undefined)).toBe(false)
  })

  it("on a ZERO-WIDTH or zero-height bbox", () => {
    expect(longPressHitsMarker(MARKER, [MARKER], { ...BOUNDS, east: BOUNDS.west }, SIZE)).toBe(false)
    expect(longPressHitsMarker(MARKER, [MARKER], { ...BOUNDS, north: BOUNDS.south }, SIZE)).toBe(false)
  })

  it("on a WRAPPED bbox (east west of west, across the antimeridian)", () => {
    const wrapped: LongPressBounds = { west: 179.9, east: -179.9, south: 37.771, north: 37.779 }
    expect(longPressHitsMarker({ lat: 37.775, lng: 180 }, [{ lat: 37.775, lng: 180 }], wrapped, SIZE)).toBe(false)
  })

  it("on a zero-size viewport (the map has not laid out yet)", () => {
    expect(longPressHitsMarker(MARKER, [MARKER], BOUNDS, { width: 0, height: 800 })).toBe(false)
    expect(longPressHitsMarker(MARKER, [MARKER], BOUNDS, { width: 400, height: 0 })).toBe(false)
  })

  it("on a non-finite press or bbox", () => {
    expect(longPressHitsMarker({ lat: Number.NaN, lng: 0 }, [MARKER], BOUNDS, SIZE)).toBe(false)
    expect(longPressHitsMarker(MARKER, [MARKER], { ...BOUNDS, north: Number.NaN }, SIZE)).toBe(false)
  })

  it("on an empty marker list", () => {
    expect(longPressHitsMarker(MARKER, [], BOUNDS, SIZE)).toBe(false)
  })
})
