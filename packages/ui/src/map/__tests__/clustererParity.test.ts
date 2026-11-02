import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { ReportPinDTO } from "@civfix/contract"
import { WORLD_BBOX, buildIndex, leavesOfCluster, queryClusters, type MapPoint } from "../clusterer"
import { PARITY_ZOOMS, parityPoints, parityRows, type ParityRow } from "./clustererParity"

interface ParityFixture {
  zooms: Record<string, ParityRow[]>
}

// Recorded on supercluster 8.0.1 from parityPoints() with parityRows() at every zoom of PARITY_ZOOMS.
const fixture = JSON.parse(
  readFileSync(new URL("./__fixtures__/clusterer-supercluster8.json", import.meta.url), "utf8"),
) as ParityFixture

// Cluster keys embed the centroid at 5 decimals and supercluster 9 computes centroids more precisely,
// so clusters match by the points they hold and their position within this tolerance.
const CENTROID_TOLERANCE = 0.00001

function matchKey(row: ParityRow): string {
  return row.type === "cluster" ? `cluster:${row.leafIds}` : `node:${row.key}`
}

function byMatchKey(rows: ParityRow[]): Map<string, ParityRow> {
  return new Map(rows.map((row) => [matchKey(row), row]))
}

function pin(id: string, lat: number, lng: number): ReportPinDTO {
  return { id, category: "trash", lat, lng, status: "published", confirmCount: 0, fixedCount: 0 }
}

function reportPoint(id: string, lat: number, lng: number): MapPoint {
  return { kind: "report", id, lat, lng, pin: pin(id, lat, lng) }
}

describe("GH#299 supercluster 9 clusters like 8", () => {
  it("T16: the same clusters and nodes as the supercluster 8 fixture at every zoom 0-12", () => {
    const index = buildIndex(parityPoints())
    for (const zoom of PARITY_ZOOMS) {
      const expected = fixture.zooms[String(zoom)] ?? []
      const actual = parityRows(index, zoom)
      expect(actual, `zoom ${zoom} node count`).toHaveLength(expected.length)
      const actualByKey = byMatchKey(actual)
      expect(actualByKey.size, `zoom ${zoom} distinct nodes`).toBe(actual.length)
      for (const want of expected) {
        const got = actualByKey.get(matchKey(want))
        if (got === undefined) throw new Error(`zoom ${zoom}: no node for ${matchKey(want)}`)
        if (want.type === "cluster") {
          const { lng, lat, ...rest } = want
          if (got.type !== "cluster")
            throw new Error(`zoom ${zoom}: ${matchKey(want)} lost its type`)
          const { lng: gotLng, lat: gotLat, ...gotRest } = got
          expect(gotRest, `zoom ${zoom} ${matchKey(want)}`).toEqual(rest)
          expect(Math.abs(gotLng - lng), `zoom ${zoom} ${matchKey(want)} lng`).toBeLessThanOrEqual(
            CENTROID_TOLERANCE,
          )
          expect(Math.abs(gotLat - lat), `zoom ${zoom} ${matchKey(want)} lat`).toBeLessThanOrEqual(
            CENTROID_TOLERANCE,
          )
        } else {
          expect(got, `zoom ${zoom} ${matchKey(want)}`).toStrictEqual(want)
        }
      }
    }
  })

  it("T17: a lone report keeps its exact input position at every zoom", () => {
    const lat = 33.84689866304397
    const lng = -118.36085169017315
    const index = buildIndex([reportPoint("r1", lat, lng)])
    for (const zoom of [0, 10, 12]) {
      const nodes = queryClusters(index, WORLD_BBOX, zoom)
      expect(nodes).toHaveLength(1)
      const [node] = nodes
      expect(node?.type).toBe("report")
      expect(node?.lat).toBe(lat)
      expect(node?.lng).toBe(lng)
    }
  })

  it("T18: a cluster's leaves are the very MapPoint objects the index was built from", () => {
    const points = Array.from({ length: 5 }, (_, i) => reportPoint(`s${i}`, 34.05, -118.25))
    const index = buildIndex(points)
    const clusters = queryClusters(index, WORLD_BBOX, 0).filter((n) => n.type === "cluster")
    expect(clusters).toHaveLength(1)
    const [cluster] = clusters
    if (cluster?.type !== "cluster" || cluster.clusterId === null) {
      throw new Error("expected one supercluster cluster at zoom 0")
    }
    const leaves = leavesOfCluster(index, cluster.clusterId)
    expect(leaves).toHaveLength(points.length)
    for (const point of points) {
      expect(leaves.find((leaf) => leaf === point)).toBe(point)
    }
  })
})

describe("GH#299 supercluster 9 is the installed major", () => {
  it("T19: packages/ui depends on supercluster ^9.1.0 or newer, and @types/supercluster is gone", () => {
    const manifestText = readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
    const manifest = JSON.parse(manifestText) as { dependencies?: Record<string, string> }
    const lockfile = readFileSync(new URL("../../../../../pnpm-lock.yaml", import.meta.url), "utf8")
    const declared = manifest.dependencies?.supercluster ?? "(none)"
    const range = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(declared)
    expect(range, `supercluster range ${declared}`).not.toBeNull()
    const [major, minor] = [Number(range?.[1]), Number(range?.[2])]
    expect(major > 9 || (major === 9 && minor >= 1)).toBe(true)
    expect(manifestText).not.toContain("@types/supercluster")
    expect(lockfile).not.toContain("@types/supercluster")
  })
})
