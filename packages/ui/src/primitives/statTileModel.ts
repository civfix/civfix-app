import { FALLBACK_LOCALE } from "../i18n/resolveLocale"

export const STAT_VALUE_UNKNOWN = "—"

export const STAT_TILE_WIDE_AT = 480

/** What a screen reader hears for a tile. `unknownSpoken` replaces the dash, which reads as "dash" or nothing. */
export function statTileSpokenLabel(label: string, value: string | null, unknownSpoken: string): string {
  return `${label}: ${value ?? unknownSpoken}`
}

export type StatTileColumns = 2 | 4

export function statTileColumns(width: number): StatTileColumns {
  return width >= STAT_TILE_WIDE_AT ? 4 : 2
}

export function formatStatValue(value: number | null, locale: string = FALLBACK_LOCALE): string | null {
  if (value === null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function formatRate(rate: number | null, locale: string = FALLBACK_LOCALE): string | null {
  if (rate === null || !Number.isFinite(rate)) return null
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(rate)
}

export const STAT_VALUE_SIZES = ["24", "20", "18"] as const

export type StatValueSize = (typeof STAT_VALUE_SIZES)[number]

const STAT_VALUE_BUDGET: Readonly<Record<StatTileColumns, readonly [number, number]>> = {
  2: [12, 16],
  4: [6, 9],
}

export function statValueSize(value: string | null, columns: StatTileColumns): StatValueSize {
  if (value === null) return "24"
  const budget = STAT_VALUE_BUDGET[columns]
  const length = [...value].length
  if (length > budget[1]) return "18"
  if (length > budget[0]) return "20"
  return "24"
}
