export const PRECISE_ZOOM = 13

export const APPROX_ZOOM = 10

export type MapCenterSource = "precise" | "approximate" | "remembered"

export interface MapCenterPoint {
  lat: number
  lng: number
}

export interface RememberedCenter extends MapCenterPoint {
  zoom: number
}

export interface MapCenterInput {
  precise: MapCenterPoint | null
  approximate: MapCenterPoint | null
  remembered: RememberedCenter | null
}

export interface MapCenterTarget extends MapCenterPoint {
  zoom: number
}

export interface MapCenterPlan {
  center: MapCenterTarget | null
  source: MapCenterSource | null
  resolved: boolean
  showFindingHint: boolean
}

const SOURCE_RANK: Record<MapCenterSource, number> = {
  remembered: 0,
  approximate: 1,
  precise: 2,
}

function onGlobe(point: MapCenterPoint | null | undefined): point is MapCenterPoint {
  if (!point) return false
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false
  return Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
}

function usableRemembered(point: RememberedCenter | null | undefined): point is RememberedCenter {
  if (!onGlobe(point)) return false
  const { zoom } = point as RememberedCenter
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= 24
}

export function resolveMapCenter({
  precise,
  approximate,
  remembered,
}: MapCenterInput): MapCenterPlan {
  if (onGlobe(precise)) {
    return {
      center: { lat: precise.lat, lng: precise.lng, zoom: PRECISE_ZOOM },
      source: "precise",
      resolved: true,
      showFindingHint: false,
    }
  }
  if (onGlobe(approximate)) {
    return {
      center: { lat: approximate.lat, lng: approximate.lng, zoom: APPROX_ZOOM },
      source: "approximate",
      resolved: true,
      showFindingHint: false,
    }
  }
  if (usableRemembered(remembered)) {
    return {
      center: { lat: remembered.lat, lng: remembered.lng, zoom: remembered.zoom },
      source: "remembered",
      resolved: false,
      showFindingHint: false,
    }
  }
  return { center: null, source: null, resolved: false, showFindingHint: true }
}

export function shouldAdoptCenter(
  current: MapCenterSource | null,
  next: MapCenterSource | null,
): boolean {
  if (next === null) return false
  if (current === null) return true
  return SOURCE_RANK[next] > SOURCE_RANK[current]
}

export function zoomForSource(source: MapCenterSource): number {
  return source === "precise" ? PRECISE_ZOOM : APPROX_ZOOM
}
