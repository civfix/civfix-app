import { describe, it, expect } from "vitest"
import type { CleanupDTO, ReportPinDTO } from "@civfix/shared"
import {
  buildIndex,
  queryClusters,
  leavesOfCluster,
  reportsOfPoints,
  expansionZoomOfCluster,
  clusterZoomTarget,
  weightsOfPoint,
  CLUSTER_RADIUS,
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_ZOOM_STEP,
  AGGREGATE_EXPAND_ZOOM,
  clusterFallbackZoom,
  type MapPoint,
  type ClusterNode,
} from "../clusterer"

const WORLD = { west: -180, south: -85, east: 180, north: 85 }

function pin(
  id: string,
  lat: number,
  lng: number,
  category: ReportPinDTO["category"] = "trash",
): ReportPinDTO {
  return { id, category, lat, lng, status: "published" }
}

function reportPoint(id: string, lat: number, lng: number): MapPoint {
  return { kind: "report", id, lat, lng, pin: pin(id, lat, lng) }
}

function eventDto(id: string, lat: number, lng: number): CleanupDTO {
  return { id, lat, lng, eventKind: "cleanup", linkedReports: [] } as unknown as CleanupDTO
}

function eventPoint(id: string, lat: number, lng: number): MapPoint {
  return { kind: "event", id, lat, lng, event: eventDto(id, lat, lng) }
}

function denseReports(n: number): MapPoint[] {
  return Array.from({ length: n }, (_, i) =>
    reportPoint(`p${i}`, 34.05 + i * 0.0001, -118.25 + i * 0.0001),
  )
}

function clustersOf(nodes: ClusterNode[]) {
  return nodes.filter((n): n is Extract<ClusterNode, { type: "cluster" }> => n.type === "cluster")
}

describe("cluster threshold table", () => {
  it("pins the tuned knobs so a regression in them is visible", () => {
    expect(CLUSTER_RADIUS).toBe(56)
    expect(CLUSTER_MAX_ZOOM).toBe(15)
    expect(CLUSTER_MIN_POINTS).toBe(2)
    expect(CLUSTER_ZOOM_STEP).toBe(2)
    expect(AGGREGATE_EXPAND_ZOOM).toBe(13)
  })

  it("groups neighbourhood-dense markers at city zoom and ungroups them above maxZoom", () => {
    const index = buildIndex(denseReports(6))
    expect(clustersOf(queryClusters(index, WORLD, 10))).toHaveLength(1)
    expect(clustersOf(queryClusters(index, WORLD, 13))).toHaveLength(1)
    const zoomedIn = queryClusters(index, WORLD, CLUSTER_MAX_ZOOM + 1)
    expect(zoomedIn).toHaveLength(6)
    expect(zoomedIn.every((n) => n.type === "report")).toBe(true)
  })

  it("keeps a report that has no neighbour within the radius as its own pin", () => {
    const nodes = queryClusters(
      buildIndex([reportPoint("a", 34.05, -118.25), reportPoint("b", 34.6, -117.4)]),
      WORLD,
      12,
    )
    expect(nodes).toHaveLength(2)
    expect(nodes.every((n) => n.type === "report")).toBe(true)
  })
})

describe("unified reports + events clustering", () => {
  it("collapses a report and an event that share a spot into one counted cluster", () => {
    const nodes = queryClusters(
      buildIndex([reportPoint("r1", 34.05, -118.25), eventPoint("e1", 34.0501, -118.2501)]),
      WORLD,
      11,
    )
    const clusters = clustersOf(nodes)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.count).toBe(2)
    expect(clusters[0]!.reportCount).toBe(1)
    expect(clusters[0]!.eventCount).toBe(1)
  })

  it("draws a lone event as an event node, not as a bubble", () => {
    const nodes = queryClusters(buildIndex([eventPoint("e1", 34.05, -118.25)]), WORLD, 11)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe("event")
  })

  it("counts a blend as one event plus each of its linked reports", () => {
    const event = eventDto("e1", 34.05, -118.25)
    const blend: MapPoint = {
      kind: "blend",
      id: "e1",
      lat: 34.05,
      lng: -118.25,
      event,
      reports: [pin("r1", 34.05, -118.25), pin("r2", 34.0501, -118.2501)],
    }
    expect(weightsOfPoint(blend)).toEqual({ reportCount: 2, eventCount: 1 })
    const clusters = clustersOf(
      queryClusters(buildIndex([blend, reportPoint("r3", 34.0502, -118.2502)]), WORLD, 11),
    )
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.count).toBe(4)
    expect(clusters[0]!.eventCount).toBe(1)
  })

  it("renders a lone server aggregate as a bubble carrying the server's count", () => {
    const nodes = queryClusters(
      buildIndex([{ kind: "aggregate", id: "a1", lat: 34.05, lng: -118.25, count: 37 }]),
      WORLD,
      10,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe("cluster")
    if (nodes[0]!.type === "cluster") {
      expect(nodes[0]!.count).toBe(37)
      expect(nodes[0]!.clusterId).toBeNull()
    }
  })

  it("adds a server aggregate's count into a cluster it merges with", () => {
    const clusters = clustersOf(
      queryClusters(
        buildIndex([
          { kind: "aggregate", id: "a1", lat: 34.05, lng: -118.25, count: 12 },
          eventPoint("e1", 34.0501, -118.2501),
        ]),
        WORLD,
        10,
      ),
    )
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.count).toBe(13)
    expect(clusters[0]!.reportCount).toBe(12)
    expect(clusters[0]!.eventCount).toBe(1)
  })
})

describe("marker identity", () => {
  it("keeps a cluster's key stable across zoom levels while its membership is unchanged", () => {
    const index = buildIndex(denseReports(5))
    const low = clustersOf(queryClusters(index, WORLD, 9))
    const high = clustersOf(queryClusters(index, WORLD, 13))
    expect(low).toHaveLength(1)
    expect(high).toHaveLength(1)
    expect(low[0]!.key).toBe(high[0]!.key)
  })

  it("changes a cluster's key as soon as its membership changes", () => {
    const grid: MapPoint[] = Array.from({ length: 16 }, (_, i) =>
      reportPoint(`g${i}`, 34.0 + (i % 4) * 0.004, -118.3 + Math.floor(i / 4) * 0.004),
    )
    const index = buildIndex(grid)
    const wide = clustersOf(queryClusters(index, WORLD, 9)).map((c) => c.key)
    const tight = clustersOf(queryClusters(index, WORLD, 13)).map((c) => c.key)
    expect(wide).toHaveLength(1)
    expect(tight.length).toBeGreaterThan(1)
    expect(tight).not.toContain(wide[0])
  })

  it("gives every node kind a prefixed, per-entity key", () => {
    const event = eventDto("e1", 40.0, -74.0)
    const nodes = queryClusters(
      buildIndex([
        reportPoint("r1", 34.05, -118.25),
        eventPoint("e2", 47.6, -122.3),
        { kind: "blend", id: "e1", lat: 40.0, lng: -74.0, event, reports: [pin("r9", 40.0, -74.0)] },
        { kind: "aggregate", id: "1,2", lat: 1, lng: 2, count: 4 },
      ]),
      WORLD,
      12,
    )
    expect(nodes.map((n) => n.key).sort()).toEqual(["a:1,2", "b:e1", "e:e2", "r:r1"])
  })
})

describe("cluster drill-down", () => {
  it("returns every enclosed point and flattens them to report pins", () => {
    const event = eventDto("e1", 34.05, -118.25)
    const index = buildIndex([
      reportPoint("r1", 34.05, -118.25),
      { kind: "blend", id: "e1", lat: 34.0501, lng: -118.2501, event, reports: [pin("r2", 34.05, -118.25)] },
      eventPoint("e2", 34.0502, -118.2502),
    ])
    const cluster = clustersOf(queryClusters(index, WORLD, 11))[0]!
    const leaves = leavesOfCluster(index, cluster.clusterId as number)
    expect(leaves).toHaveLength(3)
    expect(reportsOfPoints(leaves).map((r) => r.id).sort()).toEqual(["r1", "r2"])
  })

  it("survives a stale cluster id without throwing", () => {
    const index = buildIndex(denseReports(3))
    expect(leavesOfCluster(index, 999999)).toEqual([])
    expect(() => expansionZoomOfCluster(index, 999999)).not.toThrow()
    const stale: ClusterNode = {
      type: "cluster",
      key: "c:0,0:2",
      clusterId: 999999,
      lng: 0,
      lat: 0,
      count: 2,
      reportCount: 2,
      eventCount: 0,
    }
    expect(clusterZoomTarget(stale, 12, expansionZoomOfCluster(index, 999999))).toBe(
      CLUSTER_MAX_ZOOM + 1,
    )
    expect(clusterZoomTarget(stale, CLUSTER_MAX_ZOOM, 99)).toBeNull()
  })
})

describe("clusterZoomTarget", () => {
  const cluster = (clusterId: number | null): Extract<ClusterNode, { type: "cluster" }> => ({
    type: "cluster",
    key: "c:0,0:2",
    clusterId,
    lng: 0,
    lat: 0,
    count: 2,
    reportCount: 2,
    eventCount: 0,
  })

  it("flies to the supercluster expansion zoom when the cluster can still split", () => {
    expect(clusterZoomTarget(cluster(1), 10, 12)).toBe(12)
  })

  it("never asks for a zoom past the clustering ceiling", () => {
    expect(clusterZoomTarget(cluster(1), 14, 99)).toBe(CLUSTER_MAX_ZOOM + 1)
  })

  it("hands the last clustering zoom over to the tap-to-list surface instead of zooming", () => {
    expect(clusterZoomTarget(cluster(1), CLUSTER_MAX_ZOOM, CLUSTER_MAX_ZOOM + 1)).toBeNull()
    expect(clusterZoomTarget(cluster(1), CLUSTER_MAX_ZOOM + 0.8, CLUSTER_MAX_ZOOM + 1)).toBeNull()
    expect(clusterZoomTarget(cluster(1), CLUSTER_MAX_ZOOM - 0.1, CLUSTER_MAX_ZOOM + 1)).toBe(
      CLUSTER_MAX_ZOOM + 1,
    )
  })

  it("offers a bounded fallback zoom for a tap that has no list to open", () => {
    expect(clusterFallbackZoom(10)).toBe(12)
    expect(clusterFallbackZoom(CLUSTER_MAX_ZOOM)).toBe(CLUSTER_MAX_ZOOM + 1)
    expect(clusterFallbackZoom(Number.NaN)).toBe(CLUSTER_ZOOM_STEP)
  })

  it("takes a server aggregate to at least the zoom where the server returns individual pins", () => {
    expect(clusterZoomTarget(cluster(null), 9, null)).toBe(AGGREGATE_EXPAND_ZOOM)
    expect(clusterZoomTarget(cluster(null), 12, null)).toBe(14)
  })

  it("never hands the camera a non-finite zoom", () => {
    expect(clusterZoomTarget(cluster(null), Number.NaN, null)).toBe(AGGREGATE_EXPAND_ZOOM)
    expect(clusterZoomTarget(cluster(1), Number.NaN, null)).toBe(CLUSTER_ZOOM_STEP)
  })

  it("is a no-op for a node that is not a cluster", () => {
    const node: ClusterNode = {
      type: "report",
      key: "r:a",
      id: "a",
      lng: 0,
      lat: 0,
      pin: pin("a", 0, 0),
    }
    expect(clusterZoomTarget(node, 10, 12)).toBeNull()
  })
})

describe("query hygiene", () => {
  it("excludes points outside the query bbox", () => {
    const index = buildIndex([reportPoint("in", 34.05, -118.25), reportPoint("out", 40.7, -74.0)])
    const nodes = queryClusters(index, { west: -118.5, south: 33.9, east: -118.0, north: 34.2 }, 12)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type === "report" && nodes[0]!.id).toBe("in")
  })

  it("clamps a non-finite zoom and stays empty with no points", () => {
    expect(queryClusters(buildIndex([reportPoint("a", 34.05, -118.25)]), WORLD, Number.NaN)).toHaveLength(1)
    expect(queryClusters(buildIndex([]), WORLD, 10)).toHaveLength(0)
  })

  it("carries a report pin's optional enrichment through both a node and a cluster's leaves", () => {
    const enrich = {
      type: "graffiti" as const,
      title: "Overflowing bin",
      description: "Spilling onto the sidewalk",
      thumbUrl: "https://cdn.example/t.jpg",
      addr: "123 Main St",
      referenceCode: "CF-1234",
    }
    const points: MapPoint[] = denseReports(3).map((p) =>
      p.kind === "report" ? { ...p, pin: { ...p.pin, ...enrich } } : p,
    )
    const index = buildIndex(points)
    const solo = queryClusters(index, WORLD, CLUSTER_MAX_ZOOM + 1)[0]!
    expect(solo.type === "report" && solo.pin).toMatchObject(enrich)
    const cluster = clustersOf(queryClusters(index, WORLD, 10))[0]!
    for (const leaf of reportsOfPoints(leavesOfCluster(index, cluster.clusterId as number))) {
      expect(leaf).toMatchObject(enrich)
    }
  })
})
