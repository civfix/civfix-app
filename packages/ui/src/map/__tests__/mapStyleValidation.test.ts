import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
// eslint-disable-next-line no-restricted-imports -- maplibre validates every style it is given with this, so the test runs the same validator
import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import type { ColorSchemeName } from "@civfix/tokens"
import { DEFAULT_ATTRIBUTION, carryStyleOverlay, rasterMapStyle } from "../mapStyle"

const RADIUS = "report-pick-radius"

function basemap(scheme: ColorSchemeName, cartoApiKey?: string): StyleSpecification {
  return rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme, cartoApiKey }) as StyleSpecification
}

function lightStyleWithRadius(): StyleSpecification {
  const base = basemap("light")
  return {
    ...base,
    sources: {
      ...base.sources,
      [RADIUS]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      ...base.layers,
      {
        id: `${RADIUS}-fill`,
        type: "fill",
        source: RADIUS,
        paint: { "fill-color": "rgba(0,0,0,0.1)" },
      },
      {
        id: `${RADIUS}-line`,
        type: "line",
        source: RADIUS,
        paint: { "line-color": "rgba(0,0,0,0.5)" },
      },
    ],
  }
}

describe("GH#299 the map style validates on style-spec 26", () => {
  it.each([
    ["light", undefined],
    ["light", "abc"],
    ["dark", undefined],
    ["dark", "abc"],
  ] as const)("T20: the %s basemap (CARTO key %s) has no validation errors", (scheme, key) => {
    expect(validateStyleMin(basemap(scheme, key))).toEqual([])
  })

  it("T21: the report-pick-radius overlay carried onto the dark basemap has no validation errors", () => {
    const next = carryStyleOverlay(RADIUS)(lightStyleWithRadius(), basemap("dark"))
    expect(validateStyleMin(next)).toEqual([])
  })

  it("T22: a wrong raster-opacity type is reported as exactly one error", () => {
    const style = basemap("light")
    const raster = style.layers.find((layer) => layer.id === "basemap")
    if (raster?.type !== "raster" || raster.paint === undefined)
      throw new Error("no raster basemap")
    // Object.assign, because the typed paint (rightly) refuses a string opacity.
    Object.assign(raster.paint, { "raster-opacity": "x" })
    const errors = validateStyleMin(style)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toBe("layers[1].paint.raster-opacity: number expected, string found")
  })
})

describe("GH#299 style-spec 26 is the installed major", () => {
  it("T23: styleSwap's dropsRadius reads diff()'s commands without a cast or a ts-expect-error", () => {
    const source = readFileSync(new URL("./styleSwap.test.ts", import.meta.url), "utf8")
    const dropsRadius = /const dropsRadius = [\s\S]*?\n\n/.exec(source)?.[0] ?? ""
    expect(dropsRadius).toContain("op.command")
    expect(dropsRadius).not.toMatch(/\bas\b/)
    expect(dropsRadius).not.toContain("@ts-expect-error")
  })

  it("T24: packages/ui takes style-spec ^26 and no 24 is left in the lockfile", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { devDependencies?: Record<string, string> }
    const lockfile = readFileSync(new URL("../../../../../pnpm-lock.yaml", import.meta.url), "utf8")
    expect(manifest.devDependencies?.["@maplibre/maplibre-gl-style-spec"]).toMatch(/^\^26(\.|$)/)
    expect(lockfile).not.toMatch(/@maplibre\/maplibre-gl-style-spec@24\./)
  })
})
