import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { activeMarkerIds, markerNodeIsActive } from "../markerFocus"
import type { ClusterNode } from "../clusterer"

const mapNative = readFileSync(new URL("../Map.native.tsx", import.meta.url), "utf8")

const reportNode = { type: "report", id: "r1", key: "r:r1", lat: 0, lng: 0 } as unknown as ClusterNode
const eventNode = { type: "event", id: "c1", key: "e:c1", lat: 0, lng: 0 } as unknown as ClusterNode
const blendNode = { type: "blend", id: "c1", key: "b:c1", lat: 0, lng: 0 } as unknown as ClusterNode
const clusterNode = { type: "cluster", key: "cl:1", lat: 0, lng: 0 } as unknown as ClusterNode

describe("markerNodeIsActive", () => {
  it("lights the focused report and nothing else", () => {
    expect(markerNodeIsActive(reportNode, "r1", null)).toBe(true)
    expect(markerNodeIsActive(reportNode, "other", null)).toBe(false)
    expect(markerNodeIsActive(reportNode, null, "r1")).toBe(false)
  })

  it("lights the focused event on both the plain and the blended pin", () => {
    expect(markerNodeIsActive(eventNode, null, "c1")).toBe(true)
    expect(markerNodeIsActive(blendNode, null, "c1")).toBe(true)
    expect(markerNodeIsActive(eventNode, "c1", null)).toBe(false)
  })

  it("never lights a cluster", () => {
    expect(markerNodeIsActive(clusterNode, "cl:1", "cl:1")).toBe(false)
  })

  it("treats a null focus as no match, so an id-less node cannot light up", () => {
    const idless = { type: "report", key: "r:", lat: 0, lng: 0 } as unknown as ClusterNode
    expect(markerNodeIsActive(idless, null, null)).toBe(false)
  })
})

describe("activeMarkerIds", () => {
  it("lights the fly-to pin when the host has no focused marker", () => {
    expect(activeMarkerIds(null, null, { kind: "report", id: "r1" })).toEqual({ pinId: "r1", cleanupId: null })
    expect(activeMarkerIds(null, null, { kind: "cleanup", id: "c1" })).toEqual({ pinId: null, cleanupId: "c1" })
  })

  it("lets the host's own focused marker win", () => {
    expect(activeMarkerIds("r2", null, { kind: "report", id: "r1" })).toEqual({ pinId: "r2", cleanupId: null })
    expect(activeMarkerIds(null, "c2", { kind: "cleanup", id: "c1" })).toEqual({ pinId: null, cleanupId: "c2" })
  })

  it("lights nothing without a highlight or a focus", () => {
    expect(activeMarkerIds(null, null, null)).toEqual({ pinId: null, cleanupId: null })
  })
})

describe("a focus change must not re-render every marker", () => {
  it("renders each marker through one memoized component, not inline JSX", () => {
    expect(mapNative).toContain("const MarkerNode = memo(function MarkerNode(")
    expect(mapNative).toContain("<MarkerNode")
    expect(mapNative).toContain(
      "active={markerNodeIsActive(node, activeIds.pinId, activeIds.cleanupId)}",
    )
  })

  it("keeps the lngLat tuple stable, so an unchanged marker sends no native prop update", () => {
    expect(mapNative).toContain(
      "const lngLat = useMemo<[number, number]>(() => [node.lng, node.lat], [node.lng, node.lat])",
    )
    expect(mapNative).not.toMatch(/lngLat=\{\[node\.lng, node\.lat\]\}/)
  })
})
