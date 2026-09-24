import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// These seams need a WebGL / native map to run, so the gesture options are pinned by source.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const webSeams = {
  "Map.web": strip(read("../Map.web.tsx")),
  "ReportPickMap.web": strip(read("../ReportPickMap.web.tsx")),
  "LocationPicker.web": strip(read("../LocationPicker.web.tsx")),
}
const mapNative = strip(read("../Map.native.tsx"))

describe("every map keeps a zero bearing and zero pitch (bbox-midpoint centre, long-press hit box)", () => {
  for (const [name, src] of Object.entries(webSeams)) {
    it(`${name} turns off the rotate and pitch gestures maplibre-gl leaves on by default`, () => {
      expect(src).toContain("dragRotate: false")
      expect(src).toContain("pitchWithRotate: false")
      expect(src).toContain("touchPitch: false")
      expect(src).toContain("map.touchZoomRotate.disableRotation()")
      expect(src).toContain("map.keyboard.disableRotation()")
    })
  }

  it("Map.native passes touchRotate and touchPitch false against the library's ON defaults", () => {
    const mlMap = /<MlMap\n[\s\S]*?>/.exec(mapNative)?.[0] ?? ""
    expect(mlMap).toContain("touchRotate={false}")
    expect(mlMap).toContain("touchPitch={false}")
  })
})

describe("MapHandle.flyTo on the web seam", () => {
  it("treats FLYTO_ZOOM as a floor like the native seam, so an omitted zoom never zooms out", () => {
    const mapWeb = webSeams["Map.web"]
    const fly = /flyTo:\s*\(lat,\s*lng,\s*zoom\)\s*=>\s*\{[\s\S]*?\n\s{6}\},/.exec(mapWeb)?.[0] ?? ""
    expect(fly).not.toBe("")
    expect(fly).toContain("zoom: zoom ?? Math.max(map.getZoom(), FLYTO_ZOOM)")
    expect(fly).not.toMatch(/zoom:\s*zoom \?\? FLYTO_ZOOM\b/)
  })
})
