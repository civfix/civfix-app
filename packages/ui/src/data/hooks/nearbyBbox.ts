import type { BBox } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"

export const NEARBY_KEY_PRECISION = 3

export const NEARBY_RADIUS_KM = 2

export const KM_PER_LAT_DEGREE = 111.32

export const MIN_LNG_COSINE = 0.01

export const PIN_SPAN_MAX_DEG = (360 * 8) / 2 ** 13

export function roundNearbyCoord(n: number): number {
  const factor = 10 ** NEARBY_KEY_PRECISION
  return Math.round(n * factor) / factor
}

export function clampLat(n: number): number {
  return Math.max(-90, Math.min(90, n))
}

export function clampLng(n: number): number {
  return Math.max(-180, Math.min(180, n))
}

export function pinSpanScale(padLat: number, padLng: number): number {
  const span = Math.max(2 * padLng, 4 * padLat)
  if (!Number.isFinite(span) || span <= PIN_SPAN_MAX_DEG) return 1
  return PIN_SPAN_MAX_DEG / span
}

export function bboxAround(center: LatLng, radiusKm: number): BBox {
  const lat = roundNearbyCoord(center.lat)
  const lng = roundNearbyCoord(center.lng)
  const radius = Number.isFinite(radiusKm) ? Math.max(0, radiusKm) : 0
  const padLat = radius / KM_PER_LAT_DEGREE
  const cosine = Math.max(Math.cos((lat * Math.PI) / 180), MIN_LNG_COSINE)
  const padLng = radius / (KM_PER_LAT_DEGREE * cosine)
  const scale = pinSpanScale(padLat, padLng)
  return {
    west: clampLng(lng - padLng * scale),
    east: clampLng(lng + padLng * scale),
    south: clampLat(lat - padLat * scale),
    north: clampLat(lat + padLat * scale),
  }
}
