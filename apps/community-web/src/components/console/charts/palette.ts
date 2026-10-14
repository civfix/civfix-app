"use client"

import { colorSchemes } from "@civfix/shared/tokens"
import type { ColorSchemeName } from "@civfix/shared/tokens"

import { useColorScheme } from "@/lib/color-scheme"

export interface ChartPalette {
  scheme: ColorSchemeName
  grid: string
  axis: string
  label: string
  value: string
  strong: string
  surface: string
  track: string
  series: readonly string[]
  hue: Record<"bloom" | "moss" | "sun" | "sky" | "lilac", string>
  seriesColor: (index: number) => string
}

function chartPalette(scheme: ColorSchemeName): ChartPalette {
  const c = colorSchemes[scheme]
  const series = [
    c.chipInk.sky,
    c.chipInk.bloom,
    c.chipInk.moss,
    c.chipInk.sun,
    c.chipInk.lilac,
  ] as const
  return {
    scheme,
    grid: c.neutral.ink5,
    axis: c.neutral.ink4,
    label: c.neutral.ink3,
    value: c.neutral.ink2,
    strong: c.neutral.ink,
    surface: c.neutral.card,
    track: c.neutral.paper2,
    series,
    hue: {
      bloom: c.chipInk.bloom,
      moss: c.chipInk.moss,
      sun: c.chipInk.sun,
      sky: c.chipInk.sky,
      lilac: c.chipInk.lilac,
    },
    seriesColor: (index: number) => series[index % series.length] ?? c.neutral.ink3,
  }
}

const PALETTES: Readonly<Record<ColorSchemeName, ChartPalette>> = {
  light: chartPalette("light"),
  dark: chartPalette("dark"),
}

export function useChartPalette(): ChartPalette {
  return PALETTES[useColorScheme()]
}
