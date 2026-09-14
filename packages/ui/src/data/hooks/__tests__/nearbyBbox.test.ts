import { describe, expect, it } from "vitest"
import {
  KM_PER_LAT_DEGREE,
  NEARBY_KEY_PRECISION,
  NEARBY_RADIUS_KM,
  PIN_SPAN_MAX_DEG,
  bboxAround,
  clampLat,
  clampLng,
  roundNearbyCoord,
} from "../nearbyBbox"

const at5 = (n: number) => Number(n.toFixed(5))

describe("bboxAround circumscribes the radius circle", () => {
  it("boxes 2 km around downtown Los Angeles", () => {
    const box = bboxAround({ lat: 34.0522, lng: -118.2437 }, NEARBY_RADIUS_KM)
    expect(at5(box.south)).toBe(34.03403)
    expect(at5(box.north)).toBe(34.06997)
    expect(at5(box.west)).toBe(-118.26568)
    expect(at5(box.east)).toBe(-118.22232)
  })

  it("keeps the latitude pad constant and grows the longitude pad away from the equator", () => {
    const equator = bboxAround({ lat: 0, lng: 0 }, NEARBY_RADIUS_KM)
    const north = bboxAround({ lat: 60, lng: 10 }, NEARBY_RADIUS_KM)
    const padLat = NEARBY_RADIUS_KM / KM_PER_LAT_DEGREE
    expect(at5(equator.north)).toBe(at5(padLat))
    expect(at5(equator.east)).toBe(at5(padLat))
    expect(at5(north.north - 60)).toBe(at5(padLat))
    expect(at5(north.east - 10)).toBe(at5(2 * padLat))
  })

  it("rounds the centre to the key precision so a pin nudge does not move the box", () => {
    expect(roundNearbyCoord(34.052199)).toBe(34.052)
    expect(NEARBY_KEY_PRECISION).toBe(3)
    const a = bboxAround({ lat: 34.0521, lng: -118.2437 }, NEARBY_RADIUS_KM)
    const b = bboxAround({ lat: 34.05215, lng: -118.24374 }, NEARBY_RADIUS_KM)
    expect(a).toEqual(b)
  })

  it("shrinks a radius whose box would drop the server below the per-pin zoom", () => {
    const wide = bboxAround({ lat: 0, lng: 0 }, 50)
    const span = Math.max(wide.east - wide.west, (wide.north - wide.south) * 2)
    expect(at5(span)).toBe(at5(PIN_SPAN_MAX_DEG))
    expect(at5(wide.north)).toBe(0.08789)
  })

  it("leaves a small radius untouched by the span clamp", () => {
    const box = bboxAround({ lat: 34.05, lng: -118.24 }, NEARBY_RADIUS_KM)
    const span = Math.max(box.east - box.west, (box.north - box.south) * 2)
    expect(span).toBeLessThan(PIN_SPAN_MAX_DEG)
  })

  it("never leaves the BBox bounds at the poles or the antimeridian", () => {
    const pole = bboxAround({ lat: 89.999, lng: 179.999 }, 200)
    expect(pole.north).toBeLessThanOrEqual(90)
    expect(pole.south).toBeGreaterThanOrEqual(-90)
    expect(pole.east).toBeLessThanOrEqual(180)
    expect(pole.west).toBeGreaterThanOrEqual(-180)
    expect(clampLat(120)).toBe(90)
    expect(clampLat(-120)).toBe(-90)
    expect(clampLng(200)).toBe(180)
    expect(clampLng(-200)).toBe(-180)
  })

  it("degrades a zero or non-finite radius to a point box rather than NaN", () => {
    expect(bboxAround({ lat: 10, lng: 20 }, 0)).toEqual({
      west: 20,
      east: 20,
      south: 10,
      north: 10,
    })
    expect(bboxAround({ lat: 10, lng: 20 }, Number.NaN)).toEqual({
      west: 20,
      east: 20,
      south: 10,
      north: 10,
    })
  })
})
