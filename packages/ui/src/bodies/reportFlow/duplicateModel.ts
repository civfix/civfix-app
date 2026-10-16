import { OPEN_REPORT_STATUSES, type ReportPinDTO } from "@civfix/contract"
import type { LatLng } from "@civfix/contract/geocode"
import type { LayoutMode } from "../../theme"
import type { Step } from "../../report/wizardSteps"
import { nearbyReportRows, type NearbyReportRow } from "../linkReportsModel"

const DUPLICATE_RADIUS_M = 20
const DUPLICATE_MAX_ROWS = 5
export const DUPLICATE_WAIT_MS = 3000

const METERS_PER_KM = 1000
const OPEN = new Set(OPEN_REPORT_STATUSES)

export function duplicateMatches(pins: readonly ReportPinDTO[], center: LatLng): NearbyReportRow[] {
  return nearbyReportRows(
    pins.filter((p) => OPEN.has(p.status)),
    center,
    [],
    DUPLICATE_RADIUS_M / METERS_PER_KM,
  ).slice(0, DUPLICATE_MAX_ROWS)
}

export type DistanceLabel = { key: "close" } | { key: "about"; meters: number }

export function duplicateDistance(distanceM: number): DistanceLabel {
  if (distanceM < 5) return { key: "close" }
  return { key: "about", meters: Math.round(distanceM / 5) * 5 }
}

/**
 * The forward presses that leave a step where the point can be set. Expanded picks the point on review, so it
 * checks only there; a step without an unchecked point passes straight through the gate.
 */
export function stepChecksDuplicates(step: Step, mode: LayoutMode): boolean {
  if (step === "review") return true
  return mode === "compact" && (step === "capture" || step === "location")
}
