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

const DARK_MATTER_GROUND = "#0E0E0E"

export const DARK_RASTER_BRIGHTNESS_MIN = 0.18

const DARK_RASTER_PAINT = {
  "raster-opacity": 1,
  "raster-brightness-min": DARK_RASTER_BRIGHTNESS_MIN,
  "raster-brightness-max": 1,
  "raster-saturation": 0,
  "raster-contrast": 0,
} as const

function liftChannel(byte: number, min: number): string {
  return Math.round(min * 255 + (1 - min) * byte)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()
}

function liftHex(hex: string, min: number): string {
  const n = hex.replace("#", "")
  const channels = [n.slice(0, 2), n.slice(2, 4), n.slice(4, 6)]
  return `#${channels.map((c) => liftChannel(parseInt(c, 16), min)).join("")}`
}

const BASEMAP_PAPER: Readonly<Record<ColorSchemeName, string>> = {
  light: "#F5F3EE",
  dark: liftHex(DARK_MATTER_GROUND, DARK_RASTER_BRIGHTNESS_MIN),
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
        paint: {
          "background-color":
            scheme === "dark" ? BASEMAP_PAPER.dark : colorSchemes[scheme].neutral.paper,
        },
      },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: scheme === "dark" ? { ...DARK_RASTER_PAINT } : { "raster-opacity": 1 },
      },
    ],
  }
}

interface OverlayCarrierStyle {
  sources: Record<string, unknown>
  layers: readonly { id: string; source?: string }[]
}

/**
 * A maplibre `setStyle` transformStyle that keeps one app-owned geojson overlay across a basemap swap.
 * The default diffing swap drops every source and layer the next style does not list, and never fires
 * `style.load`, so an overlay re-added from that event would stay gone until its own data next changed.
 */
export function carryStyleOverlay(sourceId: string) {
  return <S extends OverlayCarrierStyle>(previous: S | undefined, next: S): S => {
    const source = previous?.sources[sourceId]
    if (!previous || !source) return next
    return {
      ...next,
      sources: { ...next.sources, [sourceId]: source },
      layers: [...next.layers, ...previous.layers.filter((layer) => layer.source === sourceId)],
    }
  }
}
