import { OPEN_REPORT_STATUSES, type ReportPinDTO } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { nearbyReportRows, type NearbyReportRow } from "../linkReportsModel"

// The founders are choosing between 20 and 25 m (GH#159); the build sets the final value here.
export const DUPLICATE_RADIUS_M = 25
export const DUPLICATE_MAX_ROWS = 5
export const DUPLICATE_WAIT_MS = 3000

const OPEN = new Set(OPEN_REPORT_STATUSES)

export function duplicateMatches(pins: readonly ReportPinDTO[], center: LatLng): NearbyReportRow[] {
  return nearbyReportRows(
    pins.filter((p) => OPEN.has(p.status)),
    center,
    [],
    DUPLICATE_RADIUS_M / 1000,
  ).slice(0, DUPLICATE_MAX_ROWS)
}

export type DistanceLabel = { key: "close" } | { key: "about"; meters: number }

export function duplicateDistance(distanceM: number): DistanceLabel {
  if (distanceM < 5) return { key: "close" }
  return { key: "about", meters: Math.round(distanceM / 5) * 5 }
}
