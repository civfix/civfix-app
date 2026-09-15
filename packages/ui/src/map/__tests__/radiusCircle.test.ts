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
})
