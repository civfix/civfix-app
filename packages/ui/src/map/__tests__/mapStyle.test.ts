import { describe, it, expect } from "vitest"
import { categoryColor, cleanupColorFor, colorSchemes, type ColorSchemeName } from "@civfix/shared/tokens"
import type { MapStyleInput } from "../types"
import {
  rasterMapStyle,
  withCartoKey,
  basemapPaper,
  BASEMAP_TILES,
  DARK_RASTER_BRIGHTNESS_MIN,
  DEFAULT_ATTRIBUTION,
} from "../mapStyle"

const KEYLESS_TILES = [
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
]

const KEYLESS_DARK_TILES = [
  "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{ratio}.png",
  "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{ratio}.png",
  "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{ratio}.png",
]

function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "")
  const channels = [0, 2, 4].map((i) => {
    const s = parseInt(n.slice(i, i + 2), 16) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function basemapSource(style: MapStyleInput): { tiles: string[]; attribution: string } {
  return (style as { sources: { basemap: { tiles: string[]; attribution: string } } }).sources.basemap
}

function tilesOf(style: MapStyleInput): string[] {
  return basemapSource(style).tiles
}

function tileSizeOf(style: MapStyleInput): number {
  return (style as { sources: { basemap: { tileSize: number } } }).sources.basemap.tileSize
}

function backgroundColorOf(style: MapStyleInput): string {
  const layers = (style as { layers: { id: string; paint?: Record<string, unknown> }[] }).layers
  return layers.find((layer) => layer.id === "background")?.paint?.["background-color"] as string
}

function rasterPaintOf(style: MapStyleInput): Record<string, unknown> {
  const layers = (style as { layers: { id: string; paint?: Record<string, unknown> }[] }).layers
  return layers.find((layer) => layer.id === "basemap")?.paint ?? {}
}

function liftedGround(hex: string, min: number): string {
  const n = hex.replace("#", "")
  const channels = [0, 2, 4].map((i) =>
    Math.round(min * 255 + (1 - min) * parseInt(n.slice(i, i + 2), 16))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase(),
  )
  return `#${channels.join("")}`
}

describe("withCartoKey", () => {
  const url = "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png"

  it("returns the url unchanged when no key is given", () => {
    expect(withCartoKey(url)).toBe(url)
    expect(withCartoKey(url, undefined)).toBe(url)
  })

  it("returns the url unchanged for an empty or blank key", () => {
    expect(withCartoKey(url, "")).toBe(url)
    expect(withCartoKey(url, "   ")).toBe(url)
  })

  it("appends the key as a query param", () => {
    expect(withCartoKey(url, "cb1_abc")).toBe(`${url}?key=cb1_abc`)
  })

  it("trims and url-encodes the key", () => {
    expect(withCartoKey(url, " a b&c ")).toBe(`${url}?key=a%20b%26c`)
  })
})

describe("rasterMapStyle", () => {
  it("emits the keyless tile urls when no key is configured", () => {
    expect(tilesOf(rasterMapStyle())).toEqual(KEYLESS_TILES)
    expect(tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, {}))).toEqual(KEYLESS_TILES)
    expect(tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey: "" }))).toEqual(KEYLESS_TILES)
  })

  it("keeps the whole keyless style identical to the attribution-only call", () => {
    expect(rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey: undefined })).toEqual(rasterMapStyle())
  })

  it("appends the key to every subdomain shard", () => {
    const tiles = tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey: "cb1_abc" }))
    expect(tiles).toEqual(KEYLESS_TILES.map((url) => `${url}?key=cb1_abc`))
  })

  it("leaves the attribution untouched with or without a key", () => {
    const keyed = rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey: "cb1_abc" })
    expect(basemapSource(keyed).attribution).toBe(DEFAULT_ATTRIBUTION)
  })

  it("paints the light paper background by default", () => {
    expect(backgroundColorOf(rasterMapStyle())).toBe(colorSchemes.light.neutral.paper)
    expect(backgroundColorOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "light" }))).toBe(
      colorSchemes.light.neutral.paper,
    )
  })

  it("paints the lifted dark-matter ground behind the dark tiles, not the app paper", () => {
    expect(backgroundColorOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark" }))).toBe(
      basemapPaper("dark"),
    )
    expect(basemapPaper("dark")).not.toBe(colorSchemes.dark.neutral.paper)
  })

  it("lifts the dark ground and only the ground", () => {
    const dark = rasterPaintOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark" }))
    expect(dark["raster-opacity"]).toBe(1)
    expect(dark["raster-brightness-min"]).toBe(DARK_RASTER_BRIGHTNESS_MIN)
    expect(dark["raster-brightness-max"]).toBe(1)
    expect(dark["raster-saturation"]).toBe(0)
    expect(dark["raster-contrast"]).toBe(0)
    const light = rasterPaintOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "light" }))
    expect(light).toEqual({ "raster-opacity": 1 })
  })

  it("derives basemapPaper.dark from the dark-matter ground and the same brightness floor", () => {
    expect(DARK_RASTER_BRIGHTNESS_MIN).toBeGreaterThan(0.15)
    expect(DARK_RASTER_BRIGHTNESS_MIN).toBeLessThanOrEqual(0.25)
    expect(basemapPaper("dark")).toBe(liftedGround("#0E0E0E", DARK_RASTER_BRIGHTNESS_MIN))
  })

  it("serves the voyager tiles in light and the dark-matter tiles in dark", () => {
    expect(tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "light" }))).toEqual(KEYLESS_TILES)
    expect(tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark" }))).toEqual(KEYLESS_DARK_TILES)
    expect(BASEMAP_TILES.light).toEqual(KEYLESS_TILES)
    expect(BASEMAP_TILES.dark).toEqual(KEYLESS_DARK_TILES)
  })

  it("templates retina with maplibre's own {ratio} token, on 256px tiles - never leaflet's {r}", () => {
    for (const url of [...BASEMAP_TILES.light, ...BASEMAP_TILES.dark]) {
      expect(url).toContain("{ratio}")
      expect(url).not.toMatch(/\{r\}/)
    }
    expect(tileSizeOf(rasterMapStyle())).toBe(256)
    expect(tileSizeOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark" }))).toBe(256)
  })

  it("appends the key to every dark subdomain shard too", () => {
    const tiles = tilesOf(rasterMapStyle(DEFAULT_ATTRIBUTION, { scheme: "dark", cartoApiKey: "cb1_abc" }))
    expect(tiles).toEqual(KEYLESS_DARK_TILES.map((url) => `${url}?key=cb1_abc`))
  })
})

describe("on-basemap marker contrast", () => {
  const schemes: ColorSchemeName[] = ["light", "dark"]

  it("keeps every dark pin fill clear of the dark-matter ground (3:1 non-text floor)", () => {
    const ground = basemapPaper("dark")
    for (const key of Object.keys(colorSchemes.dark.category)) {
      expect(contrast(categoryColor(key, "dark"), ground)).toBeGreaterThanOrEqual(3)
    }
    expect(contrast(cleanupColorFor("dark"), ground)).toBeGreaterThanOrEqual(3)
    expect(contrast(colorSchemes.dark.brand.bloom, ground)).toBeGreaterThanOrEqual(3)
  })

  it("keeps the basemap ground on the same side as the app paper in both schemes", () => {
    for (const scheme of schemes) {
      const sameSide =
        relativeLuminance(basemapPaper(scheme)) > 0.5 ===
        relativeLuminance(colorSchemes[scheme].neutral.paper) > 0.5
      expect(sameSide).toBe(true)
    }
  })
})
