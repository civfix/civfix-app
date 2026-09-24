/**
 * Small dependency-free geo helpers shared across fakes and runtime code.
 */

export interface LatLngLike {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_000

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance in meters (haversine). */
export function haversineMeters(a: LatLngLike, b: LatLngLike): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_M * c
}

export function haversineKm(a: LatLngLike, b: LatLngLike): number {
  return haversineMeters(a, b) / 1000
}

/**
 * How long a caller waits for a FRESH device location fix before it falls back to the approximate (IP)
 * location. A first fix can hang for many seconds, and on web `PositionOptions.timeout` does not start
 * until the permission prompt is answered, so an ignored prompt would otherwise wait forever. Every
 * surface uses this one value so the web map camera and the location-keyed queries expire together and
 * settle in one wave.
 */
export const DEVICE_FIX_TIMEOUT_MS = 4000
