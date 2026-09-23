/**
 * A centre resolution that settles with nothing must show a "search an address" state instead of loading
 * forever; a value or a later centre still mounts the map. The seams import react-native and maplibre,
 * so their wiring is pinned by source.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { pickerSurface } from "../LocationPicker.types"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("pickerSurface", () => {
  it("mounts the map as soon as any real point is known", () => {
    expect(pickerSurface({ lat: 1, lng: 2 }, false)).toBe("map")
    expect(pickerSurface({ lat: 1, lng: 2 }, true)).toBe("map")
  })

  it("waits while the host is still resolving", () => {
    expect(pickerSurface(null, false)).toBe("pending")
    expect(pickerSurface(null, undefined)).toBe("pending")
  })

  it("asks for an address once resolution settled with nothing", () => {
    expect(pickerSurface(null, true)).toBe("search")
  })
})

describe("the seams and the report flow carry the settled flag", () => {
  it("both LocationPicker seams choose their surface through pickerSurface", () => {
    for (const rel of ["../LocationPicker.web.tsx", "../LocationPicker.native.tsx"]) {
      const src = read(rel)
      expect(src, rel).toContain("pickerSurface(")
      expect(src, rel).toContain('t("hint.search_address")')
    }
  })

  it("both PortraitMapPickStep seams forward it to every picker they render", () => {
    for (const rel of ["../PortraitMapPickStep.web.tsx", "../PortraitMapPickStep.native.tsx"]) {
      const src = read(rel)
      const pickers = src.match(/<LocationPicker\b/g) ?? []
      expect(pickers.length, rel).toBeGreaterThan(0)
      expect(src.match(/centerSettled=\{centerSettled\}/g) ?? [], rel).toHaveLength(pickers.length)
    }
  })

  it("the report flow passes its resolution state to both pickers", () => {
    const flow = read("../../bodies/ReportFlowBody.tsx")
    expect(flow).toMatch(/<LocationPicker [^>]*centerSettled=\{initialCenter\.settled\}/)
    expect(flow).toMatch(/<PortraitMapPickStep[\s\S]*?centerSettled=\{pickCenter\.settled\}/)
  })
})
