import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
// eslint-disable-next-line no-restricted-imports -- maplibre's own style diff is what setStyle runs, so the test models the swap with it
import { diff, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import { carryStyleOverlay, rasterMapStyle, DEFAULT_ATTRIBUTION } from "../mapStyle"

const RADIUS = "report-pick-radius"

function lightStyleWithRadius(): StyleSpecification {
  const base = rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "light" }) as StyleSpecification
  return {
    ...base,
    sources: {
      ...base.sources,
      [RADIUS]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      ...base.layers,
      { id: `${RADIUS}-fill`, type: "fill", source: RADIUS, paint: { "fill-color": "rgba(0,0,0,0.1)" } },
      { id: `${RADIUS}-line`, type: "line", source: RADIUS, paint: { "line-color": "rgba(0,0,0,0.5)" } },
    ],
  }
}

const darkBasemap = () => rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark" }) as StyleSpecification

const dropsRadius = (ops: ReturnType<typeof diff>) =>
  ops.some(
    (op) =>
      (op.command === "removeSource" && op.args[0] === RADIUS) ||
      (op.command === "removeLayer" && String(op.args[0]).startsWith(RADIUS)),
  )

describe("a scheme swap keeps the report picker's radius overlay", () => {
  it("the bare basemap swap is what dropped it: maplibre's diff removes the overlay", () => {
    expect(dropsRadius(diff(lightStyleWithRadius(), darkBasemap()))).toBe(true)
  })

  it("carryStyleOverlay hands the next style the overlay, so the diff only swaps the basemap", () => {
    const previous = lightStyleWithRadius()
    const next = carryStyleOverlay(RADIUS)(previous, darkBasemap())
    expect(dropsRadius(diff(previous, next))).toBe(false)
    expect(next.sources[RADIUS]).toEqual(previous.sources[RADIUS])
    expect(next.layers.map((layer) => layer.id)).toEqual([
      "background",
      "basemap",
      `${RADIUS}-fill`,
      `${RADIUS}-line`,
    ])
    expect(next.layers.find((layer) => layer.id === "basemap")).toEqual(
      darkBasemap().layers.find((layer) => layer.id === "basemap"),
    )
  })

  it("passes the next style through untouched when there is no overlay to carry", () => {
    const next = darkBasemap()
    expect(carryStyleOverlay(RADIUS)(undefined, next)).toBe(next)
    expect(carryStyleOverlay(RADIUS)(darkBasemap(), next)).toBe(next)
  })

  it("ReportPickMap.web swaps its basemap through the carry", () => {
    const src = readFileSync(new URL("../ReportPickMap.web.tsx", import.meta.url), "utf8")
    expect(src).toContain("transformStyle: carryStyleOverlay(RADIUS_SOURCE_ID)")
  })
})

describe("the inline web LocationPicker follows the colour scheme", () => {
  const src = readFileSync(new URL("../LocationPicker.web.tsx", import.meta.url), "utf8")

  it("re-styles the live map when the scheme changes, in its own effect (construction stays keyed on the seed)", () => {
    const effect =
      /React\.useEffect\(\(\) => \{\n\s+const map = mapRef\.current\n\s+if \(!map \|\| styleSchemeRef\.current === th\.scheme\) return[\s\S]*?\}, \[th\.scheme\]\)/.exec(
        src,
      )?.[0] ?? ""
    expect(effect).toContain("map.setStyle(")
    expect(effect).toContain("scheme: th.scheme")
    expect(src).toContain("styleSchemeRef.current = themeRef.current.scheme\n    const map = new maplibregl.Map({")
  })
})
