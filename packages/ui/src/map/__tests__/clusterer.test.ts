/**
 * Unit tests for the pure client-side clusterer (supercluster wrapper). No React, no maplibre, so it
 * runs directly under vitest. Covers the behaviours the map relies on: isolated reports stay individual
 * pins (the "icons sooner" lever), dense reports collapse into a count cluster, a cluster knows all its
 * members (tap-to-list), bbox filtering, and the zoom clamp.
 */
import { describe, it, expect } from "vitest"
import type { ReportPinDTO } from "@civfix/shared"
import { buildIndex, queryClusters, leavesOfCluster, CLUSTER_MIN_POINTS } from "../clusterer"

/** The whole world, so bbox filtering is opt-in per test. */
const WORLD = { west: -180, south: -85, east: 180, north: 85 }

function pin(
  id: string,
  lat: number,
  lng: number,
  category: ReportPinDTO["category"] = "trash",
): ReportPinDTO {
  return { id, category, lat, lng, status: "published" }
}

/** N reports stacked essentially on top of each other (well within the cluster radius). */
function dense(n: number): ReportPinDTO[] {
  return Array.from({ length: n }, (_, i) => pin(`p${i}`, 34.05 + i * 0.0001, -118.25 + i * 0.0001))
}

describe("clusterer", () => {
  it("returns an isolated report as an individual pin (not a cluster)", () => {
    const nodes = queryClusters(buildIndex([pin("a", 34.05, -118.25)]), WORLD, 12)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe("pin")
    if (nodes[0]!.type === "pin") expect(nodes[0]!.id).toBe("a")
  })

  it("keeps fewer-than-minPoints nearby reports as individual pins", () => {
    const pts = dense(CLUSTER_MIN_POINTS - 1)
    const nodes = queryClusters(buildIndex(pts), WORLD, 10)
    expect(nodes).toHaveLength(pts.length)
    expect(nodes.every((n) => n.type === "pin")).toBe(true)
  })

  it("collapses >= minPoints nearby reports into one count cluster at a low zoom", () => {
    const pts = dense(CLUSTER_MIN_POINTS + 2)
    const nodes = queryClusters(buildIndex(pts), WORLD, 10)
    const clusters = nodes.filter((n) => n.type === "cluster")
    expect(clusters).toHaveLength(1)
    if (clusters[0]!.type === "cluster") expect(clusters[0]!.count).toBe(pts.length)
  })

  it("separates the same dense reports into individual pins when zoomed past maxZoom", () => {
    const pts = dense(CLUSTER_MIN_POINTS + 2)
    const nodes = queryClusters(buildIndex(pts), WORLD, 17)
    expect(nodes).toHaveLength(pts.length)
    expect(nodes.every((n) => n.type === "pin")).toBe(true)
  })

  it("leavesOfCluster returns every report the cluster encloses", () => {
    const pts = dense(CLUSTER_MIN_POINTS + 3)
    const index = buildIndex(pts)
    const cluster = queryClusters(index, WORLD, 10).find((n) => n.type === "cluster")
    expect(cluster?.type).toBe("cluster")
    if (cluster?.type === "cluster") {
      const leaves = leavesOfCluster(index, cluster.clusterId)
      expect(leaves).toHaveLength(pts.length)
      expect(new Set(leaves.map((l) => l.id))).toEqual(new Set(pts.map((p) => p.id)))
    }
  })

  it("carries the pin's optional enrichment through both an individual pin and a cluster's leaves", () => {
    // ClusterReportsBody paints cluster rows INSTANTLY from pin.title / pin.description / pin.thumbUrl
    // before each useReport fetch lands; the index used to strip those, killing that fast-paint path.
    const enrich = {
      type: "graffiti" as const,
      title: "Overflowing bin",
      description: "Spilling onto the sidewalk",
      thumbUrl: "https://cdn.example/t.jpg",
      addr: "123 Main St",
      referenceCode: "CF-1234",
    }
    const pts: ReportPinDTO[] = dense(CLUSTER_MIN_POINTS + 1).map((p) => ({ ...p, ...enrich }))
    const index = buildIndex(pts)

    const solo = queryClusters(buildIndex([{ ...pin("a", 34.05, -118.25), ...enrich }]), WORLD, 12)[0]!
    expect(solo.type).toBe("pin")
    if (solo.type === "pin") expect(solo.pin).toMatchObject(enrich)

    const cluster = queryClusters(index, WORLD, 10).find((n) => n.type === "cluster")
    expect(cluster?.type).toBe("cluster")
    if (cluster?.type === "cluster") {
      for (const leaf of leavesOfCluster(index, cluster.clusterId)) {
        expect(leaf).toMatchObject(enrich)
      }
    }
  })

  it("omits enrichment keys the pin never carried (no undefined noise on a bare pin)", () => {
    const nodes = queryClusters(buildIndex([pin("a", 34.05, -118.25)]), WORLD, 12)
    expect(nodes[0]!.type).toBe("pin")
    if (nodes[0]!.type === "pin") {
      expect(Object.keys(nodes[0]!.pin).sort()).toEqual(["category", "id", "lat", "lng", "status"])
    }
  })

  it("excludes reports outside the query bbox", () => {
    const index = buildIndex([pin("in", 34.05, -118.25), pin("out", 40.7, -74.0)])
    const la = { west: -118.5, south: 33.9, east: -118.0, north: 34.2 }
    const nodes = queryClusters(index, la, 12)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe("pin")
    if (nodes[0]!.type === "pin") expect(nodes[0]!.id).toBe("in")
  })

  it("does not throw on a non-finite zoom (clamps it) and stays empty for no points", () => {
    expect(queryClusters(buildIndex([pin("a", 34.05, -118.25)]), WORLD, Number.NaN)).toHaveLength(1)
    expect(queryClusters(buildIndex([]), WORLD, 10)).toHaveLength(0)
  })
})
