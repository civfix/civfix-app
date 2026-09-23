import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { markerNodeIsActive } from "../markerFocus"
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

describe("a focus change must not re-render every marker", () => {
  it("renders each marker through one memoized component, not inline JSX", () => {
    expect(mapNative).toContain("const MarkerNode = memo(function MarkerNode(")
    expect(mapNative).toContain("<MarkerNode")
    expect(mapNative).toContain(
      "active={markerNodeIsActive(node, focusedPinId, focusedCleanupId)}",
    )
  })

  it("keeps the lngLat tuple stable, so an unchanged marker sends no native prop update", () => {
    expect(mapNative).toContain(
      "const lngLat = useMemo<[number, number]>(() => [node.lng, node.lat], [node.lng, node.lat])",
    )
    expect(mapNative).not.toMatch(/lngLat=\{\[node\.lng, node\.lat\]\}/)
  })
})
