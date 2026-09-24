import Supercluster from "supercluster"
import type { BBox, CleanupDTO, ReportPinDTO } from "@civfix/shared"

export type MapPoint =
  | { kind: "report"; id: string; lat: number; lng: number; pin: ReportPinDTO }
  | { kind: "event"; id: string; lat: number; lng: number; event: CleanupDTO }
  | {
      kind: "blend"
      id: string
      lat: number
      lng: number
      event: CleanupDTO
      reports: ReportPinDTO[]
    }
  | { kind: "aggregate"; id: string; lat: number; lng: number; count: number }

export interface ClusterWeights {
  reportCount: number
  eventCount: number
}

export type ClusterNode =
  | {
      type: "cluster"
      key: string
      clusterId: number | null
      lng: number
      lat: number
      count: number
      reportCount: number
      eventCount: number
    }
  | { type: "report"; key: string; id: string; lng: number; lat: number; pin: ReportPinDTO }
  | { type: "event"; key: string; id: string; lng: number; lat: number; event: CleanupDTO }
  | {
      type: "blend"
      key: string
      id: string
      lng: number
      lat: number
      event: CleanupDTO
      reports: ReportPinDTO[]
    }

export const CLUSTER_RADIUS = 20
export const CLUSTER_MAX_ZOOM = 11
export const CLUSTER_LIST_ZOOM = 11
export const CLUSTER_MIN_POINTS = 3
export const CLUSTER_ZOOM_STEP = 2
export const AGGREGATE_EXPAND_ZOOM = 10
export const KEY_PRECISION = 5
export const WORLD_BBOX: BBox = { west: -180, south: -85, east: 180, north: 85 }

export type MapClusterIndex = Supercluster<MapPoint, ClusterWeights>

export function weightsOfPoint(point: MapPoint): ClusterWeights {
  if (point.kind === "report") return { reportCount: 1, eventCount: 0 }
  if (point.kind === "event") return { reportCount: 0, eventCount: 1 }
  if (point.kind === "blend") return { reportCount: point.reports.length, eventCount: 1 }
  return { reportCount: point.count, eventCount: 0 }
}

export function positionKey(lng: number, lat: number): string {
  return `${lng.toFixed(KEY_PRECISION)},${lat.toFixed(KEY_PRECISION)}`
}

export function buildIndex(points: MapPoint[]): MapClusterIndex {
  const index: MapClusterIndex = new Supercluster<MapPoint, ClusterWeights>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: CLUSTER_MIN_POINTS,
    map: weightsOfPoint,
    reduce: (accumulated, props) => {
      accumulated.reportCount += props.reportCount
      accumulated.eventCount += props.eventCount
    },
  })
  index.load(
    points.map((p) => ({
      type: "Feature" as const,
      properties: p,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  )
  return index
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0
  return Math.max(0, Math.min(CLUSTER_MAX_ZOOM + 1, Math.floor(zoom)))
}

function nodeOfPoint(point: MapPoint, lng: number, lat: number): ClusterNode {
  if (point.kind === "report") {
    return { type: "report", key: `r:${point.id}`, id: point.id, lng, lat, pin: point.pin }
  }
  if (point.kind === "event") {
    return { type: "event", key: `e:${point.id}`, id: point.id, lng, lat, event: point.event }
  }
  if (point.kind === "blend") {
    return {
      type: "blend",
      key: `b:${point.id}`,
      id: point.id,
      lng,
      lat,
      event: point.event,
      reports: point.reports,
    }
  }
  return {
    type: "cluster",
    key: `a:${point.id}`,
    clusterId: null,
    lng,
    lat,
    count: point.count,
    reportCount: point.count,
    eventCount: 0,
  }
}

export function queryClusters(index: MapClusterIndex, bbox: BBox, zoom: number): ClusterNode[] {
  const features = index.getClusters(
    [bbox.west, bbox.south, bbox.east, bbox.north],
    clampZoom(zoom),
  )
  return features.map((f): ClusterNode => {
    const [lng, lat] = f.geometry.coordinates as [number, number]
    const props = f.properties
    if ("cluster" in props && props.cluster === true) {
      const count = props.reportCount + props.eventCount
      return {
        type: "cluster",
        key: `c:${positionKey(lng, lat)}:${count}`,
        clusterId: props.cluster_id,
        lng,
        lat,
        count,
        reportCount: props.reportCount,
        eventCount: props.eventCount,
      }
    }
    return nodeOfPoint(props as MapPoint, lng, lat)
  })
}

export function leavesOfCluster(index: MapClusterIndex, clusterId: number): MapPoint[] {
  return index.getLeaves(clusterId, Infinity).map((f) => f.properties)
}

export function reportsOfPoints(points: MapPoint[]): ReportPinDTO[] {
  const reports: ReportPinDTO[] = []
  for (const p of points) {
    if (p.kind === "report") reports.push(p.pin)
    else if (p.kind === "blend") reports.push(...p.reports)
  }
  return reports
}

export function clusterListReports(
  index: MapClusterIndex,
  node: ClusterNode,
): ReportPinDTO[] | null {
  if (node.type !== "cluster" || node.clusterId === null) return null
  const reports = reportsOfPoints(leavesOfCluster(index, node.clusterId))
  return reports.length === node.count ? reports : null
}

export function expansionZoomOfCluster(index: MapClusterIndex, clusterId: number): number | null {
  const zoom = index.getClusterExpansionZoom(clusterId)
  return Number.isFinite(zoom) ? zoom : null
}

export function clusterZoomTarget(
  node: ClusterNode,
  currentZoom: number,
  expansion: number | null,
): number | null {
  if (node.type !== "cluster") return null
  const zoom = Number.isFinite(currentZoom) ? currentZoom : 0
  const ceiling = CLUSTER_MAX_ZOOM + 1
  const stepped = Math.min(zoom + CLUSTER_ZOOM_STEP, ceiling)
  if (node.clusterId === null) {
    const aggregateTarget = Math.max(stepped, AGGREGATE_EXPAND_ZOOM)
    return aggregateTarget > zoom ? aggregateTarget : null
  }
  if (Math.floor(zoom) >= CLUSTER_LIST_ZOOM) return null
  const target = expansion === null ? stepped : Math.min(Math.max(expansion, zoom + 1), ceiling)
  return target > zoom ? target : null
}

export function clusterPressTarget(
  index: MapClusterIndex,
  node: Extract<ClusterNode, { type: "cluster" }>,
  currentZoom: number,
): number | null {
  const expansion = node.clusterId === null ? null : expansionZoomOfCluster(index, node.clusterId)
  return clusterZoomTarget(node, currentZoom, expansion)
}

export function clusterFallbackZoom(currentZoom: number): number {
  const base = Number.isFinite(currentZoom) ? currentZoom : 0
  return Math.min(base + CLUSTER_ZOOM_STEP, CLUSTER_MAX_ZOOM + 1)
}
