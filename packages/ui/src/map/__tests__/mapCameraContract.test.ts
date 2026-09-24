import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CAMERA_EASE_MS } from "../mapCamera"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const mapNative = strip(read("../Map.native.tsx"))
const mapWeb = strip(read("../Map.web.tsx"))
const webCamera = strip(read("../homeMapCamera.web.ts"))
const webMarkers = strip(read("../domMarkerLayer.web.ts"))

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
    expect(webCamera).toContain("}, [mapReady, mode, focus, mapRef, occlusionLeftRef])")
    expect(mapWeb).toContain("useFocusAndFlyToCamera(mapRef, mapReady, mode, focus, flyToRequest, occlusionLeftRef)")
    expect(mapNative).toContain("}, [focus])")
    expect(webCamera).not.toContain("focus?.id, focus?.lat")
    expect(mapNative).not.toContain("focus?.id, focus?.lat")
  })
})

describe("the Show on map fly-to on both seams", () => {
  it("never gates the marker tree on the fly-to request: only a focus narrows the map to one pin", () => {
    expect(mapNative).toContain("{focus ? (")
    expect(mapNative).not.toMatch(/flyTo(Request|Highlight) \?/)
    expect(mapNative).toContain("if (focus) return [{ lat: focus.lat, lng: focus.lng }]")
    expect(mapWeb).toContain("const focused = useMapFocus.getState().focus\n      if (focused) {")
    expect(mapWeb).not.toMatch(/useMapFlyTo\.getState\(\)\.(request|highlight)\) \{/)
    expect(mapWeb).toContain("const nodes = query(mapBoundsToBBox(map), map.getZoom())\n        for (const node of nodes) {")
  })

  it("lights the fly-to pin through the per-node active path", () => {
    expect(mapNative).toContain("activeMarkerIds(focusedPinId, focusedCleanupId, flyToHighlight)")
    expect(mapNative).toContain("active={markerNodeIsActive(node, activeIds.pinId, activeIds.cleanupId)}")
    expect(mapWeb).toContain("activeMarkerIds(\n    focusedPinId,\n    focusedCleanupId,\n    flyToHighlight,\n  )")
    expect(mapWeb).toContain("const active = activePinId === node.id")
    expect(mapWeb).toContain("}, [runner, mapReady, index, points, activePinId, activeCleanupId, flyToHighlight, focus, th.scheme])")
  })

  it("eases to the request at the focus zoom once the map is ready, then consumes it", () => {
    expect(mapNative).toContain("if (!flyToRequest || !mapLoaded) return")
    expect(mapNative).toContain("useMapFlyTo.getState().consume(flyToRequest.generation)")
    expect(mapNative).toContain("}, [flyToRequest, mapLoaded])")
    expect(webCamera).toContain("if (!map || !mapReady || !flyToRequest) return")
    expect(webCamera).toContain(
      "map.easeTo({ center: [lng, flyToRequest.lat], zoom: FOCUS_ZOOM, duration: CAMERA_EASE_MS })",
    )
    expect(CAMERA_EASE_MS).toBe(600)
    expect(webCamera).toContain("useMapFlyTo.getState().consume(flyToRequest.generation)")
  })

  it("ends the highlight on a user camera gesture or a marker tap", () => {
    expect(mapNative).toMatch(/if \(!event\.nativeEvent\.userInteraction\) return\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/)
    expect(mapNative.match(/markerPressedAtRef\.current = Date\.now\(\)\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/g)).toHaveLength(4)
    expect(mapWeb).toMatch(/if \(!e\.originalEvent\) return\n\s+useMapFlyTo\.getState\(\)\.clear\(\)\n\s+onUserCameraMoveRef\.current\?\.\(\)/)
    expect(mapWeb).toContain('map.on("movestart", endFlyToOnUserGesture)')
    expect(webMarkers).toMatch(/e\.stopPropagation\(\)\n\s+press\(\)/)
    expect(webMarkers).toMatch(/const press = \(\) => \{\n\s+beforePress\?\.\(\)\n\s+onClick\.fn\?\.\(\)/)
    expect(mapWeb).toMatch(/function endFlyToHighlight\(\): void \{\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/)
    expect(mapWeb).toContain("syncMarkers(map, markersRef.current, desired, endFlyToHighlight)")
  })
})

describe("a Show on map target the map has not loaded", () => {
  it("draws one standalone target marker only when the id is not among the rendered nodes", () => {
    expect(mapNative).toContain("() => (focus ? null : flyToTargetOffMap(nodes, flyToHighlight))")
    expect(mapNative).toMatch(/\{offMapTarget \? \(\n\s+<TargetMarker\n\s+key=\{`flyto:\$\{offMapTarget\.kind\}:\$\{offMapTarget\.id\}`\}\n\s+target=\{offMapTarget\}/)
    expect(mapWeb).toContain("const offMapTarget = flyToTargetOffMap(nodes, flyToHighlight)\n        if (offMapTarget) putTargetMarker(offMapTarget)")
  })

  it("keeps the whole marker tree beside the standalone marker", () => {
    const nativeTree = /<>\n[\s\S]*?<\/>/.exec(mapNative)?.[0] ?? ""
    expect(nativeTree).toContain("markerNodes.rendered.map(")
    expect(nativeTree).toContain("{offMapTarget ? (")
    const webElse = /\} else \{\n\s+const nodes = query[\s\S]*?if \(offMapTarget\) putTargetMarker\(offMapTarget\)/.exec(mapWeb)?.[0] ?? ""
    expect(webElse).toContain("for (const node of nodes) {")
  })

  it("draws it with the focus marker, so it opens the detail like any pin", () => {
    expect(mapNative.match(/<TargetMarker\n/g)).toHaveLength(2)
    expect(mapNative.match(/onPressPin=\{handlePressPin\}\n\s+onPressCleanup=\{handlePressCleanup\}/g)).toHaveLength(2)
    expect(mapWeb).toContain("putTargetMarker(focused)")
    expect(mapWeb).toContain("onClick: () => onPressCleanupRef.current?.(target.id),")
    expect(mapWeb).toContain("onClick: () => onPressPinRef.current?.(target.id),")
  })

  it("keeps a native long press on the standalone marker from dropping a pin", () => {
    expect(mapNative).toContain(
      'if (offMapTarget) markers.push({ lat: offMapTarget.lat, lng: offMapTarget.lng, anchor: "bottom" })',
    )
  })
})

describe("the web user-gesture signal", () => {
  it("also treats a wheel zoom as a user gesture, since a single-notch scroll zoom starts with no originalEvent", () => {
    expect(mapWeb).toContain('map.on("wheel", endFlyToOnUserGesture)')
    expect(mapWeb).toContain("const endFlyToOnUserGesture = (e: { originalEvent?: unknown }) => {\n      if (!e.originalEvent) return")
  })
})
