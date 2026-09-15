import { describe, expect, it } from "vitest"
import { haversineMeters } from "@civfix/shared"
import { RADIUS_CIRCLE_STEPS, radiusCircleFeature } from "../radiusCircle"

const LA = { lat: 34.0522, lng: -118.2437 }

describe("radiusCircleFeature", () => {
  it("returns a closed polygon ring with steps + 1 points", () => {
    const feature = radiusCircleFeature(LA, 500)
    expect(feature.geometry.type).toBe("Polygon")
    const ring = feature.geometry.coordinates[0]!
    expect(ring).toHaveLength(RADIUS_CIRCLE_STEPS + 1)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it("places every vertex about the requested radius from the centre", () => {
    const ring = radiusCircleFeature(LA, 500).geometry.coordinates[0]!
    for (const [lng, lat] of ring) {
      const d = haversineMeters(LA, { lat, lng })
      expect(Math.abs(d - 500)).toBeLessThan(5)
    }
  })

  it("never drops below eight steps", () => {
    expect(radiusCircleFeature(LA, 100, 2).geometry.coordinates[0]).toHaveLength(9)
  })

  it("stays bounded at the poles: latitudes clamp to 90 and the ring stays finite", () => {
    const ring = radiusCircleFeature({ lat: 89.999, lng: 12 }, 500).geometry.coordinates[0]!
    for (const [lng, lat] of ring) {
      expect(Number.isFinite(lng)).toBe(true)
      expect(lat).toBeLessThanOrEqual(90)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(Math.abs(lng - 12)).toBeLessThanOrEqual(180)
    }
  })

  it("keeps a continuous ring across the antimeridian instead of wrapping vertices", () => {
    const ring = radiusCircleFeature({ lat: -16.5, lng: 179.999 }, 500).geometry.coordinates[0]!
    for (let i = 1; i < ring.length; i++) {
      expect(Math.abs(ring[i]![0] - ring[i - 1]![0])).toBeLessThan(1)
    }
  })

  it("degrades a non-finite radius or centre to a point-sized ring instead of NaN", () => {
    const ring = radiusCircleFeature({ lat: Number.NaN, lng: Number.NaN }, Number.NaN).geometry.coordinates[0]!
    for (const [lng, lat] of ring) {
      expect(lng).toBe(0)
      expect(lat).toBe(0)
    }
  })
})
