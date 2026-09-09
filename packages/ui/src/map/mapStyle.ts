import { colorSchemes, type ColorSchemeName } from "@civfix/shared/tokens"
import type { MapStyleInput } from "./types"

const CARTO_SHARDS = ["a", "b", "c"]

function cartoTiles(styleId: string): string[] {
  return CARTO_SHARDS.map(
    (shard) => `https://${shard}.basemaps.cartocdn.com/rastertiles/${styleId}/{z}/{x}/{y}{ratio}.png`,
  )
}

export const BASEMAP_TILES: Readonly<Record<ColorSchemeName, readonly string[]>> = {
  light: cartoTiles("voyager"),
  dark: cartoTiles("dark_all"),
}

const BASEMAP_PAPER: Readonly<Record<ColorSchemeName, string>> = {
  light: "#F5F3EE",
  dark: "#0E0E0E",
}

export function basemapPaper(scheme: ColorSchemeName): string {
  return BASEMAP_PAPER[scheme]
}

export const DEFAULT_ATTRIBUTION = "(c) OpenStreetMap contributors, (c) CARTO"

export function withCartoKey(url: string, key?: string): string {
  const trimmed = key?.trim()
  return trimmed ? `${url}?key=${encodeURIComponent(trimmed)}` : url
}

export interface RasterMapStyleOptions {
  cartoApiKey?: string
  scheme?: ColorSchemeName
}

export function rasterMapStyle(
  attribution: string = DEFAULT_ATTRIBUTION,
  opts: RasterMapStyleOptions = {},
): MapStyleInput {
  const scheme = opts.scheme ?? "light"
  return {
    version: 8,
    name: "civfix-raster-basemap",
    sources: {
      basemap: {
        type: "raster",
        tiles: BASEMAP_TILES[scheme].map((url) => withCartoKey(url, opts.cartoApiKey)),
        tileSize: 256,
        minzoom: 0,
        maxzoom: 20,
        attribution: attribution || DEFAULT_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": colorSchemes[scheme].neutral.paper },
      },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: { "raster-opacity": 1 },
      },
    ],
  }
}
