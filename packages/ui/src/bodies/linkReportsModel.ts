import {
  MAX_LINKED_REPORTS,
  haversineMeters,
  type EventKind,
  type ReportPinDTO,
} from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import type { HostStage } from "@civfix/shared/host"

export const NEARBY_PREVIEW = 3

export const LINKED_REPORTS_COUNT_AT = 3

const METERS_PER_KM = 1000

export type LinkBlockState = "hidden" | "pin_first" | "ready"

export function linkBlockState(input: {
  isCleanup: boolean
  hasCoords: boolean
  linkedCount: number
}): LinkBlockState {
  if (!input.isCleanup) return "hidden"
  if (!input.hasCoords && input.linkedCount === 0) return "pin_first"
  return "ready"
}

export type LinkToggleOutcome = "added" | "removed" | "at_limit"

export interface LinkToggleResult {
  ids: string[]
  outcome: LinkToggleOutcome
}

export function toggleLinkedReportId(
  ids: readonly string[],
  id: string,
  max = MAX_LINKED_REPORTS,
): LinkToggleResult {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), outcome: "removed" }
  if (ids.length >= max) return { ids: ids as string[], outcome: "at_limit" }
  return { ids: [...ids, id], outcome: "added" }
}

export interface NearbyReportRow {
  pin: ReportPinDTO
  distanceM: number
}

export function nearbyReportRows(
  pins: readonly ReportPinDTO[],
  center: LatLng,
  linkedIds: readonly string[],
  radiusKm: number,
): NearbyReportRow[] {
  const linked = new Set(linkedIds)
  const maxMeters = Math.max(0, radiusKm) * METERS_PER_KM
  const rows: NearbyReportRow[] = []
  for (const pin of pins) {
    if (!pin || linked.has(pin.id)) continue
    const distanceM = haversineMeters(center, { lat: pin.lat, lng: pin.lng })
    if (distanceM > maxMeters) continue
    rows.push({ pin, distanceM })
  }
  rows.sort((a, b) => {
    const aResolved = a.pin.status === "resolved" ? 1 : 0
    const bResolved = b.pin.status === "resolved" ? 1 : 0
    if (aResolved !== bResolved) return aResolved - bResolved
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM
    return a.pin.id < b.pin.id ? -1 : a.pin.id > b.pin.id ? 1 : 0
  })
  return rows
}

export type LinkSheetMode = "manage" | "readonly" | "hidden"

export function linkSheetMode(input: {
  stage: HostStage
  canManage: boolean
  isCleanup: boolean
  linkedCount: number
}): LinkSheetMode {
  if (!input.isCleanup || !input.canManage) return "hidden"
  if (input.stage === "upcoming" || input.stage === "soon" || input.stage === "underway") {
    return "manage"
  }
  return input.linkedCount > 0 ? "readonly" : "hidden"
}

export function linkedReportsPatch(ids: readonly string[]): { linkedReportIds: string[] } {
  return { linkedReportIds: [...ids] }
}

export interface LinkedReportsSummary {
  labelKey: "wizard.summary.reports"
  valueKey: "wizard.summary.reports_count" | "wizard.summary.noReports"
  count: number
}

export function linkedReportsSummary(input: {
  eventKind: EventKind
  linkedCount: number
}): LinkedReportsSummary | null {
  if (input.eventKind !== "cleanup") return null
  return {
    labelKey: "wizard.summary.reports",
    valueKey: input.linkedCount > 0 ? "wizard.summary.reports_count" : "wizard.summary.noReports",
    count: input.linkedCount,
  }
}

export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}
