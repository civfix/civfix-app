import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const mapNative = strip(read("../Map.native.tsx"))

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
