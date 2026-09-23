/**
 * The web maps are built once per mount and torn down by their effect cleanup, so their construction
 * effects must not list a value that changes while the map lives. Inputs read at construction come from
 * latest-value refs written after commit; the dependencies that are listed must be stable identities.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { expectWrittenInLayoutEffect, sliceBetween } from "../../__tests__/sourceGuards"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("LocationPicker.web", () => {
  const src = read("../LocationPicker.web.tsx")
  const inline = sliceBetween(src, "function InlineLocationPicker(", "function samePickPoint(")
  const mainMap = sliceBetween(src, "function MainMapLocationPicker(", "export function LocationPicker(")

  it("builds the inline map once per seed, placing the first marker from the committed value", () => {
    expect(sliceBetween(inline, "const ensureMarker = React.useCallback(", "React.useEffect(")).toContain(
      "    [],\n  )",
    )
    const build = sliceBetween(inline, "if (mapRef.current || !containerRef.current || !cameraSeed) return", "React.useEffect(")
    expect(build).toContain("if (valueRef.current) ensureMarker(map, start)")
    expect(build).toContain("}, [cameraSeed, ensureMarker])")
    expectWrittenInLayoutEffect(inline, "valueRef.current = value")
  })

  it("starts the main-map pick session once, from the committed value", () => {
    const start = sliceBetween(mainMap, "useLocationPick.getState().start(valueRef", "React.useEffect(")
    expect(start).toContain("}, [])")
    expectWrittenInLayoutEffect(mainMap, "valueRef.current = value")
  })
})

describe("Map.web", () => {
  const src = read("../Map.web.tsx")

  it("keeps the idle runner for the life of the component, so listing it never rebuilds the map", () => {
    expect(src).toContain("if (runnerRef.current === null) runnerRef.current = createIdleRunner(")
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useEffect(")
    expect(build).toContain("}, [runner])")
  })

  it("reads the initial basemap from the last committed render", () => {
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useEffect(")
    expect(build).toContain("const basemap = basemapRef.current")
    expect(build).toContain("style: (basemap.mapStyle ??")
    expectWrittenInLayoutEffect(src, "basemapRef.current = { mapStyle, cartoApiKey }")
  })
})

describe("ReportPickMap.web", () => {
  const src = read("../ReportPickMap.web.tsx")

  it("builds its map once and reads the CARTO key from the last committed render", () => {
    expect(src).toContain("if (runnerRef.current === null) runnerRef.current = createIdleRunner(")
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useMemo(")
    expect(build).toContain("cartoApiKey: cartoApiKeyRef.current,")
    expect(build).toContain("}, [runner])")
    expectWrittenInLayoutEffect(src, "cartoApiKeyRef.current = cartoApiKey")
  })
})

describe("PortraitMapPickStep", () => {
  it("web seeds its point on the open edge only, from the committed value", () => {
    const src = read("../PortraitMapPickStep.web.tsx")
    const seed = sliceBetween(src, "if (!live) return\n", "}, [live])")
    expect(seed).toContain("setLocalPoint(valueRef.current ?? null)")
    expect(seed).not.toMatch(/\bvalue \?\?/)
    expectWrittenInLayoutEffect(src, "valueRef.current = value")
  })

  it("native drop and address handlers list the stable point setter", () => {
    const src = read("../PortraitMapPickStep.native.tsx")
    expect(sliceBetween(src, "const setLocalPoint = useCallback(", "const onConfirmRef")).toContain("    [],\n  )")
    expect(sliceBetween(src, "const onPickPlace = useCallback(", "const onMapDrop")).toContain("[setLocalPoint],")
    expect(src).toContain("setLocalPoint({ lat, lng }), [setLocalPoint])")
  })
})
