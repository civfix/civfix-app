import type { LatLng } from "@civfix/shared/geocode"

export const RADIUS_CIRCLE_STEPS = 48

const EARTH_RADIUS_M = 6371008.8

export interface RadiusCircleFeature {
  type: "Feature"
  properties: Record<string, never>
  geometry: { type: "Polygon"; coordinates: [number, number][][] }
}

export function radiusCircleFeature(
  center: LatLng,
  radiusM: number,
  steps = RADIUS_CIRCLE_STEPS,
): RadiusCircleFeature {
  const count = Math.max(8, Math.floor(steps))
  const latRad = (center.lat * Math.PI) / 180
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI)
  const cosine = Math.max(Math.cos(latRad), 0.01)
  const dLng = dLat / cosine
  const ring: [number, number][] = []
  for (let i = 0; i <= count; i++) {
    const angle = (i / count) * Math.PI * 2
    ring.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)])
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }
}
