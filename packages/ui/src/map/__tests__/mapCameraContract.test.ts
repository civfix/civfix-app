import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const mapNative = strip(read("../Map.native.tsx"))
const mapWeb = strip(read("../Map.web.tsx"))

describe("MapHandle.flyTo on the native seam", () => {
  it("treats DEFAULT_ZOOM as a FLOOR, not a target, when the caller passes no zoom", () => {
    const fly = /flyTo:\s*\(lat,\s*lng,\s*zoom\)\s*=>\s*\{[\s\S]*?\n\s{6}\},/.exec(mapNative)?.[0] ?? ""
    expect(fly).not.toBe("")
    expect(fly).toContain("zoom ?? Math.max(")
    expect(fly).toContain("DEFAULT_ZOOM")
    expect(fly).not.toMatch(/zoom:\s*zoom \?\? DEFAULT_ZOOM/)
  })

  it("reads the floor from the live viewport the map last reported", () => {
    expect(mapNative).toContain("Math.max(lastRegionRef.current?.zoom ?? DEFAULT_ZOOM, DEFAULT_ZOOM)")
  })
})

describe("the focus ease on both seams", () => {
  it("keys on the focus object, so re-publishing the same pin eases back to it", () => {
    expect(mapWeb).toContain("}, [mapReady, mode, focus])")
    expect(mapNative).toContain("}, [focus])")
    expect(mapWeb).not.toContain("focus?.id, focus?.lat")
    expect(mapNative).not.toContain("focus?.id, focus?.lat")
  })
})

describe("the Show on map fly-to on both seams", () => {
  it("never gates the marker tree on the fly-to request: only a focus narrows the map to one pin", () => {
    expect(mapNative).toContain("{focus ? (")
    expect(mapNative).not.toMatch(/flyTo(Request|Highlight) \?/)
    expect(mapNative).toContain("if (focus) return [{ lat: focus.lat, lng: focus.lng }]")
    expect(mapWeb).toContain("if (useMapFocus.getState().focus) {")
    expect(mapWeb).not.toMatch(/useMapFlyTo\.getState\(\)\.(request|highlight)\) \{/)
    expect(mapWeb).toContain("for (const node of query(mapBoundsToBBox(map), map.getZoom()))")
  })

  it("lights the fly-to pin through the per-node active path", () => {
    expect(mapNative).toContain("activeMarkerIds(focusedPinId, focusedCleanupId, flyToHighlight)")
    expect(mapNative).toContain("active={markerNodeIsActive(node, activeIds.pinId, activeIds.cleanupId)}")
    expect(mapWeb).toContain("activeMarkerIds(\n    focusedPinId,\n    focusedCleanupId,\n    flyToHighlight,\n  )")
    expect(mapWeb).toContain("const active = activePinId === node.id")
    expect(mapWeb).toContain("}, [runner, mapReady, index, points, activePinId, activeCleanupId, focus, th.scheme])")
  })

  it("eases to the request at the focus zoom once the map is ready, then consumes it", () => {
    expect(mapNative).toContain("if (!flyToRequest || !mapLoaded) return")
    expect(mapNative).toContain("useMapFlyTo.getState().consume(flyToRequest.generation)")
    expect(mapNative).toContain("}, [flyToRequest, mapLoaded])")
    expect(mapWeb).toContain("if (!map || !mapReady || !flyToRequest) return")
    expect(mapWeb).toContain("map.easeTo({ center: [lng, flyToRequest.lat], zoom: FOCUS_ZOOM, duration: 600 })")
    expect(mapWeb).toContain("useMapFlyTo.getState().consume(flyToRequest.generation)")
  })

  it("ends the highlight on a user camera gesture or a marker tap", () => {
    expect(mapNative).toMatch(/if \(!event\.nativeEvent\.userInteraction\) return\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/)
    expect(mapNative.match(/markerPressedAtRef\.current = Date\.now\(\)\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/g)).toHaveLength(4)
    expect(mapWeb).toMatch(/if \(!e\.originalEvent\) return\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/)
    expect(mapWeb).toMatch(/e\.stopPropagation\(\)\n\s+useMapFlyTo\.getState\(\)\.clear\(\)\n\s+onClick\.fn\?\.\(\)/)
  })
})
