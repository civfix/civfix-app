/**
 * The "events near you" cutoff `useNearbyCleanups` applies in `select` (`filterCleanupsWithinRadius`).
 * The 50 km cutoff is a feed/sidebar policy: on a MAP marker layer it would silently delete pins for anyone
 * whose nearest event is further away, and panning can never bring them back because the list is anchored
 * to the viewer. Map hosts opt out with `radiusM: null`, which must pass the raw list through unchanged.
 */
import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { NEARBY_RADIUS_M, filterCleanupsWithinRadius } from "../feed"

const VIEWER = { lat: 37.7749, lng: -122.4194 }

/** A minimal CleanupDTO - only the distance-relevant fields matter here. */
function cleanup(id: string, lat: number, lng: number, dist?: number | null): CleanupDTO {
  return {
    id,
    title: `Event ${id}`,
    type: "site",
    lat,
    lng,
    scheduledAt: new Date().toISOString(),
    status: "upcoming",
    organizer: { id: "org", name: "Org", isFollowing: false } as CleanupDTO["organizer"],
    going: 0,
    joined: false,
    bring: [],
    address: null,
    ...(dist === undefined ? {} : { dist }),
  } as unknown as CleanupDTO
}

describe("filterCleanupsWithinRadius", () => {
  it("keeps events inside the radius and drops the ones beyond it (server `dist`)", () => {
    const items = [
      cleanup("near", 37.78, -122.41, 3_000),
      cleanup("edge", 37.9, -122.6, NEARBY_RADIUS_M),
      cleanup("far", 38.6, -121.5, 120_000),
    ]
    expect(filterCleanupsWithinRadius(items, VIEWER, NEARBY_RADIUS_M).map((c) => c.id)).toEqual([
      "near",
      "edge",
    ])
  })

  it("falls back to haversine when an older server omits `dist`", () => {
    // ~0.05 deg of latitude is ~5.5 km; 2 deg is ~222 km.
    const items = [cleanup("near", 37.82, -122.4194), cleanup("far", 39.77, -122.4194)]
    expect(filterCleanupsWithinRadius(items, VIEWER, NEARBY_RADIUS_M).map((c) => c.id)).toEqual([
      "near",
    ])
  })

  it("prefers the server `dist` over the haversine fallback", () => {
    // Coordinates say ~222 km away, but the server (authoritative, PostGIS) says 1 km: keep it.
    const items = [cleanup("server-says-near", 39.77, -122.4194, 1_000)]
    expect(filterCleanupsWithinRadius(items, VIEWER, NEARBY_RADIUS_M)).toHaveLength(1)
  })

  it("treats a null `dist` as 'not computed' and falls back to haversine", () => {
    const items = [cleanup("far", 39.77, -122.4194, null)]
    expect(filterCleanupsWithinRadius(items, VIEWER, NEARBY_RADIUS_M)).toHaveLength(0)
  })

  it("keeps everything for a radius large enough to cover the list (map-style opt-out)", () => {
    // The map passes `radiusM: null`, which skips `select` entirely; this is the same net contract -
    // a distant event must NEVER be dropped from a marker layer.
    const items = [cleanup("far", 39.77, -122.4194, 220_000), cleanup("near", 37.78, -122.41, 3_000)]
    expect(filterCleanupsWithinRadius(items, VIEWER, Number.POSITIVE_INFINITY)).toHaveLength(2)
  })
})
