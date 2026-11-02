import type { CleanupDTO, ReportPinDTO } from "@civfix/contract"
import {
  WORLD_BBOX,
  expansionZoomOfCluster,
  leavesOfCluster,
  queryClusters,
  type MapClusterIndex,
  type MapPoint,
} from "../clusterer"

/** Zooms 0-12: every zoom the clusterer serves, CLUSTER_MAX_ZOOM + 1 included. */
export const PARITY_ZOOMS = Array.from({ length: 13 }, (_, zoom) => zoom)

/**
 * One node of `queryClusters` as the supercluster 8 fixture records it. `leafIds` are the sorted ids of
 * the points a cluster stands for, space-separated so a row stays one line; an aggregate that
 * supercluster did not group (clusterId null) stands for itself.
 */
export type ParityRow =
  | { type: "report" | "event" | "blend"; key: string; lng: number; lat: number }
  | {
      type: "cluster"
      count: number
      reportCount: number
      eventCount: number
      clusterIdNull: boolean
      leafIds: string
      expansionZoom: number | null
      lng: number
      lat: number
    }

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pin(id: string, lat: number, lng: number): ReportPinDTO {
  return { id, category: "trash", lat, lng, status: "published", confirmCount: 0, fixedCount: 0 }
}

function cleanup(id: string, lat: number, lng: number): CleanupDTO {
  return {
    id,
    title: `Event ${id}`,
    type: "site",
    eventKind: "cleanup",
    lat,
    lng,
    scheduledAt: "2026-06-10T00:00:00.000Z",
    status: "upcoming",
    organizer: {
      id: "u1",
      name: "Org",
      followers: 0,
      following: 0,
      isFollowing: false,
      avatar: null,
    },
    going: 0,
    joined: false,
    bring: [],
    address: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
  }
}

const CITIES = [
  { name: "la", lat: 34.05, lng: -118.25 },
  { name: "oak", lat: 37.8, lng: -122.27 },
]

/**
 * 258 points from a seeded generator: per city 100 reports and 10 events in a dense group (spread
 * 0.2°, a third of them within 0.01°), plus 2 blends and 2 aggregates; then 30 scattered outliers
 * across the world.
 */
export function parityPoints(): MapPoint[] {
  const rand = mulberry32(299)
  const points: MapPoint[] = []
  for (const city of CITIES) {
    for (let i = 0; i < 110; i++) {
      const spread = i % 3 === 0 ? 0.01 : 0.2
      const lat = city.lat + (rand() - 0.5) * spread
      const lng = city.lng + (rand() - 0.5) * spread
      const id = `${city.name}-${i}`
      points.push(
        i % 11 === 5
          ? { kind: "event", id: `e-${id}`, lat, lng, event: cleanup(`e-${id}`, lat, lng) }
          : { kind: "report", id: `r-${id}`, lat, lng, pin: pin(`r-${id}`, lat, lng) },
      )
    }
    for (let i = 0; i < 2; i++) {
      const lat = city.lat + (rand() - 0.5) * 0.05
      const lng = city.lng + (rand() - 0.5) * 0.05
      const id = `b-${city.name}-${i}`
      points.push({
        kind: "blend",
        id,
        lat,
        lng,
        event: cleanup(id, lat, lng),
        reports: [pin(`${id}-r0`, lat, lng), pin(`${id}-r1`, lat, lng)],
      })
    }
    for (let i = 0; i < 2; i++) {
      const lat = city.lat + (rand() - 0.5) * 0.4
      const lng = city.lng + (rand() - 0.5) * 0.4
      points.push({ kind: "aggregate", id: `a-${city.name}-${i}`, lat, lng, count: 5 + i * 7 })
    }
  }
  for (let i = 0; i < 30; i++) {
    const lat = (rand() - 0.5) * 140
    const lng = (rand() - 0.5) * 340
    const id = `out-${i}`
    points.push(
      i % 4 === 0
        ? { kind: "event", id: `e-${id}`, lat, lng, event: cleanup(`e-${id}`, lat, lng) }
        : { kind: "report", id: `r-${id}`, lat, lng, pin: pin(`r-${id}`, lat, lng) },
    )
  }
  return points
}

export function parityRows(index: MapClusterIndex, zoom: number): ParityRow[] {
  return queryClusters(index, WORLD_BBOX, zoom).map((node): ParityRow => {
    if (node.type !== "cluster") {
      return { type: node.type, key: node.key, lng: node.lng, lat: node.lat }
    }
    const leafIds =
      node.clusterId === null
        ? [node.key.slice("a:".length)]
        : leavesOfCluster(index, node.clusterId)
            .map((p) => p.id)
            .sort()
    return {
      type: "cluster",
      count: node.count,
      reportCount: node.reportCount,
      eventCount: node.eventCount,
      clusterIdNull: node.clusterId === null,
      leafIds: leafIds.join(" "),
      expansionZoom: node.clusterId === null ? null : expansionZoomOfCluster(index, node.clusterId),
      lng: node.lng,
      lat: node.lat,
    }
  })
}
