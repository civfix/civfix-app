/**
 * Unit tests for the shared "where is the main map currently looking" store. Pure zustand, so vitest
 * exercises it directly (no maplibre / RN renderer). The .web/.native Map seams PUBLISH their region to it
 * on every move-settle; AddressSearch READS it to bias address suggestions toward the visible area.
 *
 * Coverage:
 *   - defaults: no viewport published yet.
 *   - setRegion: stores bbox + zoom and derives center as the bbox midpoint.
 *   - setRegion again: replaces the viewport (the map moved).
 *   - clear: drops the viewport back to null (the map unmounting, so a later flow does not bias to a stale view).
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useMapViewport, viewportBias } from "../mapViewportStore"

const BBOX = { west: -118.3, south: 34.0, east: -118.2, north: 34.1 }

beforeEach(() => {
  useMapViewport.setState({ viewport: null })
})

describe("mapViewportStore: defaults", () => {
  it("starts with no published viewport", () => {
    expect(useMapViewport.getState().viewport).toBeNull()
  })
})

describe("mapViewportStore: setRegion", () => {
  it("stores bbox + zoom and derives the center as the bbox midpoint", () => {
    useMapViewport.getState().setRegion(BBOX, 14)
    const vp = useMapViewport.getState().viewport
    expect(vp?.bbox).toEqual(BBOX)
    expect(vp?.zoom).toBe(14)
    expect(vp?.center.lat).toBeCloseTo(34.05, 6)
    expect(vp?.center.lng).toBeCloseTo(-118.25, 6)
  })

  it("replaces the viewport when the map moves", () => {
    useMapViewport.getState().setRegion(BBOX, 14)
    const next = { west: -74.1, south: 40.6, east: -73.9, north: 40.8 }
    useMapViewport.getState().setRegion(next, 11)
    const vp = useMapViewport.getState().viewport
    expect(vp?.zoom).toBe(11)
    expect(vp?.center.lat).toBeCloseTo(40.7, 6)
    expect(vp?.center.lng).toBeCloseTo(-74.0, 6)
  })
})

describe("mapViewportStore: clear", () => {
  it("drops the viewport back to null", () => {
    useMapViewport.getState().setRegion(BBOX, 14)
    useMapViewport.getState().clear()
    expect(useMapViewport.getState().viewport).toBeNull()
  })
})

describe("viewportBias", () => {
  it("returns null when no map is mounted (caller falls back to its device/IP fix)", () => {
    expect(viewportBias(null, 0.6)).toBeNull()
  })

  it("biases to the view center, the rounded live zoom, and the given scale", () => {
    useMapViewport.getState().setRegion(BBOX, 13.7)
    const bias = viewportBias(useMapViewport.getState().viewport, 0.6)
    expect(bias).toEqual({
      proximity: { lat: 34.05, lng: -118.25 },
      proximityZoom: 14, // 13.7 rounded - Photon's "zoom" is a coarse focus radius
      locationBiasScale: 0.6,
    })
  })
})
