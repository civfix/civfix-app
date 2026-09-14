import type { CleanupDTO, ReportClusterDTO, ReportPinDTO } from "@civfix/shared"
import { computeMapBlends } from "./blend"
import { positionKey, type MapPoint } from "./clusterer"

export interface MapPointsInput {
  reports: ReportPinDTO[]
  cleanups: CleanupDTO[]
  aggregates: ReportClusterDTO[]
}

function finite(n: number): boolean {
  return Number.isFinite(n)
}

export function mapPointsFor(input: MapPointsInput): MapPoint[] {
  const { blends, standaloneReports, standaloneCleanups } = computeMapBlends(
    input.reports,
    input.cleanups,
  )
  const points: MapPoint[] = []
  for (const r of standaloneReports) {
    if (!finite(r.lat) || !finite(r.lng)) continue
    points.push({ kind: "report", id: r.id, lat: r.lat, lng: r.lng, pin: r })
  }
  for (const c of standaloneCleanups) {
    if (!finite(c.lat) || !finite(c.lng)) continue
    points.push({ kind: "event", id: c.id, lat: c.lat, lng: c.lng, event: c })
  }
  for (const b of blends) {
    if (!finite(b.event.lat) || !finite(b.event.lng)) continue
    points.push({
      kind: "blend",
      id: b.event.id,
      lat: b.event.lat,
      lng: b.event.lng,
      event: b.event,
      reports: b.reports,
    })
  }
  for (const a of input.aggregates) {
    if (a.count <= 0 || !finite(a.lat) || !finite(a.lng)) continue
    points.push({
      kind: "aggregate",
      id: positionKey(a.lng, a.lat),
      lat: a.lat,
      lng: a.lng,
      count: a.count,
    })
  }
  return points
}
