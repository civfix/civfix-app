import type { ColorSchemeName } from "@civfix/shared/tokens"

export type OnboardingMapStage = "report" | "track" | "together"

export interface GeoPoint {
  readonly lat: number
  readonly lng: number
}

export interface MapFraction {
  readonly x: number
  readonly y: number
}

export interface BoxSize {
  readonly width: number
  readonly height: number
}

export interface BoxPoint {
  readonly left: number
  readonly top: number
}

export interface OnboardingMapScene {
  readonly stage: OnboardingMapStage
  readonly place: string
  readonly center: GeoPoint
  readonly zoom: number
  readonly widthPt: number
  readonly heightPt: number
}

export const ONBOARDING_MAP_STAGES: readonly OnboardingMapStage[] = ["report", "track", "together"]

export const ONBOARDING_MAP_SCALES = [2] as const
export type OnboardingMapScale = (typeof ONBOARDING_MAP_SCALES)[number]

export const ONBOARDING_MAP_SCHEMES: readonly ColorSchemeName[] = ["light", "dark"]

export const LA_BASIN_BOUNDS = {
  south: 33.7,
  north: 34.35,
  west: -118.7,
  east: -118.1,
} as const

const STILL_WIDTH_PT = 390

export const ONBOARDING_MAP_SCENES: Readonly<Record<OnboardingMapStage, OnboardingMapScene>> = {
  report: {
    stage: "report",
    place: "Highland Park, Avenue 52 at Buchanan Street",
    center: { lat: 34.1196, lng: -118.2035 },
    zoom: 16,
    widthPt: STILL_WIDTH_PT,
    heightPt: 340,
  },
  track: {
    stage: "track",
    place: "Boyle Heights, East 4th Street at Hollenbeck Park",
    center: { lat: 34.04, lng: -118.215 },
    zoom: 16,
    widthPt: STILL_WIDTH_PT,
    heightPt: 272,
  },
  together: {
    stage: "together",
    place: "Echo Park Lake, boathouse shore",
    center: { lat: 34.074, lng: -118.2606 },
    zoom: 16,
    widthPt: STILL_WIDTH_PT,
    heightPt: 140,
  },
}

export const REPORT_PIN_SPOT: GeoPoint = { lat: 34.11888, lng: -118.20312 }

export const TRACK_PIN_SPOTS: readonly GeoPoint[] = [
  { lat: 34.04123, lng: -118.21291 },
  { lat: 34.04097, lng: -118.21621 },
  { lat: 34.04029, lng: -118.21203 },
  { lat: 34.04068, lng: -118.21692 },
  { lat: 34.04145, lng: -118.21751 },
  { lat: 34.04048, lng: -118.21344 },
  { lat: 34.0401, lng: -118.21517 },
]

export const TRACK_CLUSTER_SPOT: GeoPoint = { lat: 34.04029, lng: -118.21416 }

export const TOGETHER_EVENT_SPOT: GeoPoint = { lat: 34.07333, lng: -118.26001 }

export function mapArtFileName(
  stage: OnboardingMapStage,
  scheme: ColorSchemeName,
  scale: OnboardingMapScale,
): string {
  return `${stage}-${scheme}@${scale}x.png`
}

const TILE_PT = 256

function worldPt(zoom: number): number {
  return TILE_PT * 2 ** zoom
}

export function projectPoint(point: GeoPoint, zoom: number): MapFraction {
  const world = worldPt(zoom)
  const sinLat = Math.sin((point.lat * Math.PI) / 180)
  return {
    x: ((point.lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * world,
  }
}

export function fractionInScene(scene: OnboardingMapScene, point: GeoPoint): MapFraction {
  const center = projectPoint(scene.center, scene.zoom)
  const target = projectPoint(point, scene.zoom)
  return {
    x: 0.5 + (target.x - center.x) / scene.widthPt,
    y: 0.5 + (target.y - center.y) / scene.heightPt,
  }
}

export function pointInBox(scene: OnboardingMapScene, point: GeoPoint, box: BoxSize): BoxPoint {
  const fraction = fractionInScene(scene, point)
  const scale = Math.max(box.width / scene.widthPt, box.height / scene.heightPt)
  const drawnWidth = scene.widthPt * scale
  const drawnHeight = scene.heightPt * scale
  return {
    left: fraction.x * drawnWidth + (box.width - drawnWidth) / 2,
    top: fraction.y * drawnHeight + (box.height - drawnHeight) / 2,
  }
}
