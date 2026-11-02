import { haversineMeters, type ReportPinDTO, type ReportStatus } from "@civfix/contract"
import type { LatLng } from "@civfix/contract/geocode"

const METERS_PER_LAT_DEGREE = (6_371_000 * Math.PI) / 180

/** The point `meters` due north of `center`, as `haversineMeters` measures it. */
export function northOf(center: LatLng, meters: number): LatLng {
  return { lat: center.lat + meters / METERS_PER_LAT_DEGREE, lng: center.lng }
}

const bits = new Float64Array(1)
const ulps = new BigInt64Array(bits.buffer)

function stepUlps(x: number, n: number): number {
  bits[0] = x
  ulps[0] = (ulps[0] as bigint) + BigInt(n)
  return bits[0]
}

/**
 * A point `haversineMeters` puts at exactly `meters`, found among the doubles next to `northOf`, so a
 * boundary case tests the boundary rather than a rounding error beside it. Only some centres have one.
 */
export function exactlyNorthOf(center: LatLng, meters: number): LatLng {
  const near = northOf(center, meters).lat
  for (let n = -64; n <= 64; n++) {
    const point = { lat: stepUlps(near, n), lng: center.lng }
    if (haversineMeters(center, point) === meters) return point
  }
  throw new Error(`no double puts a point exactly ${meters} m from this centre`)
}

export function pinAt(id: string, at: LatLng, status: ReportStatus = "published"): ReportPinDTO {
  return {
    id,
    category: "trash",
    status,
    lat: at.lat,
    lng: at.lng,
    title: `Report ${id}`,
    confirmCount: 0,
    fixedCount: 0,
  }
}
