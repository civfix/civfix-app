import type { LatLng } from "@civfix/shared/geocode"
import { MIN_LNG_COSINE, clampLat } from "../data/geoBounds"

export const RADIUS_CIRCLE_STEPS = 48

const EARTH_RADIUS_M = 6371008.8
const MAX_HALF_SPAN_DEG = 180

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
  const lat = clampLat(Number.isFinite(center.lat) ? center.lat : 0)
  const lng = Number.isFinite(center.lng) ? center.lng : 0
  const radius = Number.isFinite(radiusM) ? Math.max(0, radiusM) : 0
  const latRad = (lat * Math.PI) / 180
  const dLat = (radius / EARTH_RADIUS_M) * (180 / Math.PI)
  const cosine = Math.max(Math.cos(latRad), MIN_LNG_COSINE)
  const dLng = Math.min(dLat / cosine, MAX_HALF_SPAN_DEG)
  const ring: [number, number][] = []
  for (let i = 0; i <= count; i++) {
    const angle = (i / count) * Math.PI * 2
    ring.push([lng + dLng * Math.cos(angle), clampLat(lat + dLat * Math.sin(angle))])
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }
}
